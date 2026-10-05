import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../../lib/supabase';
import { Icon } from '../forms/Icon';
import { adminCopy as a } from '../../content/adminCopy';
import type { IconName } from '../../lib/icons';

export type AdminPage = 'dashboard' | 'tickets' | 'inbox' | 'lessons';

const navItems: { id: AdminPage; href: string; label: string; icon: IconName }[] = [
  { id: 'dashboard', href: '/admin/dashboard', label: a.nav.dashboard, icon: 'home' },
  { id: 'tickets', href: '/admin/tickets', label: a.nav.tickets, icon: 'question' },
  { id: 'inbox', href: '/admin/inbox', label: a.nav.inbox, icon: 'mail' },
  { id: 'lessons', href: '/admin/lessons', label: a.nav.lessons, icon: 'book' },
];

let leaving = false;
function leave(why: keyof typeof a.login.reasons) {
  if (leaving) return;
  leaving = true;
  window.location.replace(`/admin?why=${why}`);
}

// Every admin screen sits inside this. It checks the sign-in first, then shows the navigation.
// The page itself is not secret. The database rules decide what the owner may see.
export function AdminShell({
  current,
  title,
  children,
}: {
  current: AdminPage;
  title: string;
  children: (supabase: SupabaseClient) => ComponentChildren;
}) {
  const supabase = useMemo(() => getSupabase(), []);
  const [state, setState] = useState<'checking' | 'off' | 'ready'>('checking');

  useEffect(() => {
    if (!supabase) {
      setState('off');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return leave('signin');
      const { data: isOwner, error } = await supabase.rpc('is_owner');
      if (error || isOwner !== true) {
        leaving = true;
        await supabase.auth.signOut();
        leaving = false;
        return leave('notowner');
      }
      if (!cancelled) setState('ready');
    })();
    // If the session ends while the page is open (for example it timed out), send the owner back to sign in.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') leave('expired');
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    leaving = true;
    await supabase?.auth.signOut();
    leaving = false;
    leave('signedout');
  }

  if (state !== 'ready' || !supabase) {
    return (
      <main id="main" tabIndex={-1} class="admin-narrow">
        <h1>{a.pageTitle}</h1>
        <p role="status">{state === 'off' ? a.notConfigured : a.checking}</p>
      </main>
    );
  }

  return (
    <div class="admin">
      <header class="admin-side on-dark">
        <a href="/admin/dashboard" class="admin-brand" aria-label={a.brandLabel}>
          <img src="/logos/byte-sized-buddies-mark-reversed.svg" width="40" height="40" alt="" style="border-radius: 10px;" />
          <span>{a.pageTitle}</span>
        </a>
        <nav aria-label={a.navLabel}>
          <ul>
            {navItems.map((item) => (
              <li key={item.id}>
                <a href={item.href} aria-current={item.id === current ? 'page' : undefined}>
                  <Icon name={item.icon} size={24} />
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <button type="button" class="button button-secondary" onClick={signOut}>
          {a.nav.signOut}
        </button>
      </header>
      <main id="main" tabIndex={-1} class="admin-main">
        <h1>{title}</h1>
        {children(supabase)}
      </main>
    </div>
  );
}
