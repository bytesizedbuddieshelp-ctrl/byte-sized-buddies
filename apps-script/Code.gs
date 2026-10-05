// Byte-Sized Buddies Gmail bridge. Runs in the owner's own Google account.
// It copies emails labeled BSB to the website, sends the emails the website queues,
// tells the owner about new questions and requests, and keeps the database awake.
//
// Script Properties required (Project Settings > Script Properties):
//   SUPABASE_URL       https://your-project.supabase.co
//   SUPABASE_ANON_KEY  the public anon key (the same one the website uses; never the service_role key)
//   BRIDGE_SECRET      a long random secret; only its SHA-256 hash is stored in the database
//   OWNER_EMAIL        the Gmail address this script runs in
//   SITE_URL           https://your-site.pages.dev (no slash at the end)
//   GMAIL_LABEL        optional, defaults to BSB
//
// Setup steps are in apps-script/README.md. Never paste the secret anywhere else.

var SENDS_PER_RUN = 20;        // never send more than this many emails in one run
var DAILY_RESERVE = 5;         // leave a few of Gmail's ~100 daily sends for the owner's own use
var INBOX_BATCH = 50;          // rows per upload to the database
var SEEN_HOURS = 6;            // remember copied messages this long, so bodies are not re-read every run

function cfg_() {
  var p = PropertiesService.getScriptProperties();
  var c = {
    url: (p.getProperty('SUPABASE_URL') || '').replace(/\/+$/, ''),
    anon: p.getProperty('SUPABASE_ANON_KEY'),
    secret: p.getProperty('BRIDGE_SECRET'),
    owner: (p.getProperty('OWNER_EMAIL') || '').trim().toLowerCase(),
    site: (p.getProperty('SITE_URL') || '').replace(/\/+$/, ''),
    label: p.getProperty('GMAIL_LABEL') || 'BSB'
  };
  var missing = ['url', 'anon', 'secret', 'owner'].filter(function (k) { return !c[k]; });
  if (missing.length) throw new Error('Missing Script Properties: ' + missing.join(', ') + '. See apps-script/README.md.');
  return c;
}

function rpc_(fn, body) {
  var c = cfg_();
  var res = UrlFetchApp.fetch(c.url + '/rest/v1/rpc/' + fn, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: c.anon, Authorization: 'Bearer ' + c.anon },
    payload: JSON.stringify(Object.assign({ p_secret: c.secret }, body || {}))
  });
  // The error text comes from the database, never from our request, so the secret is not echoed.
  if (res.getResponseCode() >= 300) throw new Error(fn + ' failed: ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
  var t = res.getContentText();
  return t ? JSON.parse(t) : null;
}

// "Name <a@b.com>" or "a@b.com"  ->  { name, email }
function parseFrom_(from) {
  var match = String(from || '').match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].replace(/"/g, '').trim() || match[2].trim(), email: match[2].trim() };
  return { name: String(from || '').trim(), email: String(from || '').trim() };
}

function isOwner_(from, owner) {
  return parseFrom_(from).email.toLowerCase() === owner;
}

// The 5-minute trigger runs this.
function tick() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    pushInbox_('newer_than:7d');
    processWork_();
  } finally {
    lock.releaseLock();
  }
}

// Copy labeled emails to the website. Messages copied in the last few hours are skipped.
function pushInbox_(window) {
  var c = cfg_();
  var cache = CacheService.getScriptCache();
  var threads = GmailApp.search('label:' + c.label + ' ' + window, 0, 30);
  var rows = [];
  var ids = [];
  threads.forEach(function (th) {
    var messages = th.getMessages();
    var seen = cache.getAll(messages.map(function (m) { return 'seen:' + m.getId(); }));
    messages.forEach(function (m) {
      if (seen['seen:' + m.getId()]) return;
      if (isOwner_(m.getFrom(), c.owner)) return;               // skip the owner's own mail
      var from = parseFrom_(m.getFrom());
      rows.push({
        gmail_message_id: m.getId(), gmail_thread_id: th.getId(),
        from_name: from.name.slice(0, 200), from_email: from.email.slice(0, 200),
        subject: (m.getSubject() || '').slice(0, 300), body_text: (m.getPlainBody() || '').slice(0, 8000),
        received_at: m.getDate().toISOString()
      });
      ids.push(m.getId());
    });
  });
  for (var i = 0; i < rows.length; i += INBOX_BATCH) {
    rpc_('bridge_upsert_inbox', { p_rows: rows.slice(i, i + INBOX_BATCH) });
    var done = {};
    ids.slice(i, i + INBOX_BATCH).forEach(function (id) { done['seen:' + id] = '1'; });
    cache.putAll(done, SEEN_HOURS * 3600);
  }
  return rows.length;
}

// How many emails this run may still send.
function sendBudget_() {
  var left = MailApp.getRemainingDailyQuota() - DAILY_RESERVE;
  return Math.max(0, Math.min(SENDS_PER_RUN, left));
}

// Reply to the other person's latest message. Thread.reply() would answer whoever wrote last,
// which is the owner if they already replied once.
function replyInThread_(threadId, body, owner) {
  var th = GmailApp.getThreadById(threadId);
  if (!th) throw new Error('That Gmail conversation was not found. It may have been deleted.');
  var messages = th.getMessages();
  for (var i = messages.length - 1; i >= 0; i--) {
    if (!isOwner_(messages[i].getFrom(), owner)) {
      messages[i].reply(body);
      return;
    }
  }
  throw new Error('No message from the other person was found in that conversation.');
}

function processWork_() {
  var c = cfg_();
  var budget = sendBudget_();
  if (budget === 0) return;                                   // queued emails wait for tomorrow
  var work = rpc_('bridge_get_work');

  (work.outbox || []).forEach(function (o) {
    if (budget <= 0) return;
    budget--;
    try {
      if (/[\r\n]/.test(o.to_email) || /[\r\n]/.test(o.subject)) throw new Error('bad header');
      if (o.kind === 'reply' && o.gmail_thread_id) {
        replyInThread_(o.gmail_thread_id, o.body_text, c.owner);
      } else {
        GmailApp.sendEmail(o.to_email, o.subject, o.body_text, { name: 'Byte-Sized Buddies' });
      }
      rpc_('bridge_mark_outbox', { p_id: o.id, p_ok: true, p_error: null });
    } catch (e) {
      rpc_('bridge_mark_outbox', { p_id: o.id, p_ok: false, p_error: String(e).slice(0, 300) });
    }
  });

  (work.notify_tickets || []).forEach(function (t) {
    if (budget <= 0) return;
    budget--;
    GmailApp.sendEmail(c.owner, 'New question from ' + t.requester_name,
      t.question.slice(0, 500) + '\n\nAnswer it here: ' + c.site + '/admin/tickets');
    rpc_('bridge_mark_notified', { p_kind: 'ticket', p_id: t.id });
  });

  (work.notify_contacts || []).forEach(function (r) {
    if (budget <= 0) return;
    budget--;
    GmailApp.sendEmail(c.owner, 'New request from ' + r.facility,
      (r.message || '(No message.)').slice(0, 500) + '\n\nSee the details here: ' + c.site + '/admin/inbox');
    rpc_('bridge_mark_notified', { p_kind: 'contact', p_id: r.id });
  });
}

// Runs once a day: clears old data, and catches any email labeled BSB late (up to 30 days back).
function dailyPurge() {
  var counts = rpc_('bridge_purge');
  console.log('Removed old items: ' + JSON.stringify(counts));
  pushInbox_('newer_than:30d');
}

// Run once by hand to set up the timers. Running it again replaces them.
function install() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('dailyPurge').timeBased().everyDays(1).atHour(3).create();
  console.log('Done. The bridge now runs every 5 minutes, and cleans up once a day.');
}

// Run by hand to check the setup. It sends nothing and changes nothing.
function testSetup() {
  var c = cfg_();
  console.log('Script Properties found.');
  var work = rpc_('bridge_get_work');
  console.log('The database accepted the secret. Waiting to send: ' + (work.outbox || []).length +
    ' emails, ' + (work.notify_tickets || []).length + ' question alerts, ' +
    (work.notify_contacts || []).length + ' request alerts.');
  var threads = GmailApp.search('label:' + c.label, 0, 5);
  console.log('Gmail label "' + c.label + '": ' + (threads.length ? 'found conversations.' : 'no conversations yet (that is fine).'));
  console.log('Emails Gmail will still let you send today: ' + MailApp.getRemainingDailyQuota());
}
