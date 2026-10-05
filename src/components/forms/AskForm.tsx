import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Field } from './Field';
import { ChoiceGroup } from './ChoiceGroup';
import { ErrorSummary, type FormProblem } from './ErrorSummary';
import { Icon } from './Icon';
import { copy } from '../../content/copy';
import { isValidEmail, lengthBetween } from '../../lib/validators';
import { isConfigured } from '../../lib/config';
import { ApiError, callRpc, genericError } from '../../lib/publicApi';
import { makeToken } from '../../lib/token';

type Errors = Partial<Record<'name' | 'email' | 'question', string>>;

const t = copy.ask;

// The "Ask a question" form. The browser makes the private token, so only the asker ever has the link.
export default function AskForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [problems, setProblems] = useState<FormProblem[]>([]);
  const [focusSignal, setFocusSignal] = useState(0);
  const [status, setStatus] = useState('');
  const [sendError, setSendError] = useState('');
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState('');
  const thanks = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (link) thanks.current?.focus();
  }, [link]);

  async function onSubmit(event: JSX.TargetedEvent<HTMLFormElement, Event>) {
    event.preventDefault();
    if (sending) return;
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? '').trim();

    const found: FormProblem[] = [];
    if (!value('name')) found.push({ id: 'name', label: t.fields.name, message: copy.form.errors.name });
    // Email is optional, but if someone types one it has to look right.
    if (value('email') && !isValidEmail(value('email'))) {
      found.push({ id: 'email', label: t.fields.email, message: copy.form.errors.email });
    }
    const size = lengthBetween(value('question'), 5, 2000);
    if (size !== 'ok') {
      found.push({
        id: 'question',
        label: t.fields.question,
        message: size === 'short' ? copy.form.errors.questionShort : copy.form.errors.questionLong,
      });
    }

    setErrors(Object.fromEntries(found.map((p) => [p.id, p.message])) as Errors);
    setProblems(found);
    setSendError('');
    if (found.length > 0) {
      setStatus('');
      setFocusSignal((n) => n + 1);
      return;
    }
    if (!isConfigured) {
      setStatus(copy.form.notConnected);
      return;
    }

    setSending(true);
    setStatus('');
    const token = makeToken();
    try {
      await callRpc('submit_ticket', {
        p_token: token,
        p_name: value('name'),
        p_facility: value('facility'),
        p_email: value('email'),
        p_device: value('device'),
        p_urgency: value('urgency'),
        p_question: value('question'),
        p_website: value('website'),
      });
      setLink(`${window.location.origin}/answer?t=${token}`);
    } catch (error) {
      setSendError(error instanceof ApiError ? error.message : genericError);
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(t.success.copied);
    } catch {
      setCopied(t.success.copyFailed);
    }
  }

  if (link) {
    return (
      <div class="form-done" ref={thanks} tabIndex={-1}>
        <h2 class="form-done-title">
          <Icon name="check" size={28} /> {t.success.title}
        </h2>
        <p class="field-label" id="answer-link-label">
          {t.success.linkLabel}
        </p>
        <input class="field-control" type="text" readOnly value={link} aria-labelledby="answer-link-label" onFocus={(e) => e.currentTarget.select()} />
        <div class="actions">
          <button type="button" class="button button-primary" onClick={copyLink}>
            <Icon name="copy" size={24} /> {t.success.copy}
          </button>
          <a class="button button-secondary" href={link}>
            {copy.answer.title}
          </a>
        </div>
        <p role="status" class="caption">
          {copied}
        </p>
        <p>
          <strong>{t.success.save}</strong>
        </p>
        <p>{t.success.emailNote}</p>
        <button
          type="button"
          class="button button-secondary"
          onClick={() => {
            setLink('');
            setCopied('');
          }}
        >
          {t.success.again}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <ErrorSummary problems={problems} focusSignal={focusSignal} />
      <Field id="name" label={t.fields.name} required autoComplete="name" error={errors.name} />
      <Field id="facility" label={t.fields.facility} optional autoComplete="organization" />
      <Field
        id="email"
        label={t.fields.email}
        type="email"
        optional
        autoComplete="email"
        helper={t.fields.emailHelper}
        error={errors.email}
      />
      <ChoiceGroup name="device" legend={t.fields.deviceLegend} options={[...t.devices]} type="radio" defaultValue="not_sure" />
      <ChoiceGroup name="urgency" legend={t.fields.urgencyLegend} options={[...t.urgency]} type="radio" defaultValue="whenever" />
      <Field
        id="question"
        label={t.fields.question}
        as="textarea"
        rows={6}
        required
        helper={`${t.fields.questionHelper} ${copy.form.privacyHelper}`}
        error={errors.question}
      />
      <div class="hp" aria-hidden="true">
        <label>
          Leave this empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {sendError && (
        <p class="field-error" role="alert">
          <Icon name="alert" size={24} />
          <span>
            <span class="visually-hidden">{copy.form.errorPrefix} </span>
            {sendError}
          </span>
        </p>
      )}
      <button type="submit" class="button button-primary" disabled={sending} aria-disabled={sending}>
        {sending ? copy.form.sending : t.submit}
      </button>
      <div class="form-status" role="status">
        {status}
      </div>
    </form>
  );
}
