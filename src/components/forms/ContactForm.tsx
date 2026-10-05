import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Field } from './Field';
import { ChoiceGroup } from './ChoiceGroup';
import { ErrorSummary, type FormProblem } from './ErrorSummary';
import { Icon } from './Icon';
import { copy } from '../../content/copy';
import { isValidEmail } from '../../lib/validators';
import { isConfigured } from '../../lib/config';
import { ApiError, callRpc, genericError } from '../../lib/publicApi';

type Errors = Partial<Record<'name' | 'facility' | 'email', string>>;

const t = copy.homes;

// The "Request a visit" form. It checks the answers, then sends them to the database.
export default function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [problems, setProblems] = useState<FormProblem[]>([]);
  const [focusSignal, setFocusSignal] = useState(0);
  const [status, setStatus] = useState('');
  const [sendError, setSendError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const thanks = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (done) thanks.current?.focus();
  }, [done]);

  async function onSubmit(event: JSX.TargetedEvent<HTMLFormElement, Event>) {
    event.preventDefault();
    if (sending) return;
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? '').trim();

    const found: FormProblem[] = [];
    if (!value('name')) found.push({ id: 'name', label: t.fields.name, message: copy.form.errors.name });
    if (!value('facility')) found.push({ id: 'facility', label: t.fields.facility, message: copy.form.errors.facility });
    if (!isValidEmail(value('email'))) found.push({ id: 'email', label: t.fields.email, message: copy.form.errors.email });

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
    try {
      await callRpc('submit_contact_request', {
        p_name: value('name'),
        p_facility: value('facility'),
        p_role: value('role'),
        p_email: value('email'),
        p_phone: value('phone'),
        p_learner_count: value('learners'),
        p_devices: data.getAll('devices').map(String),
        p_times: value('times'),
        p_message: value('more'),
        p_website: value('website'),
      });
      setDone(true);
    } catch (error) {
      setSendError(error instanceof ApiError ? error.message : genericError);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div class="form-done" ref={thanks} tabIndex={-1} role="status">
        <h3 class="form-done-title">
          <Icon name="check" size={28} /> {t.success.title}
        </h3>
        <p>{t.success.text}</p>
        <button
          type="button"
          class="button button-secondary"
          onClick={() => {
            setDone(false);
            setStatus('');
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
      <Field id="facility" label={t.fields.facility} required autoComplete="organization" error={errors.facility} />
      <Field id="role" label={t.fields.role} optional autoComplete="organization-title" />
      <Field id="email" label={t.fields.email} type="email" required autoComplete="email" error={errors.email} />
      <Field id="phone" label={t.fields.phone} type="tel" optional autoComplete="tel" />
      <Field id="learners" label={t.fields.learners} optional inputMode="numeric" />
      <ChoiceGroup name="devices" legend={t.fields.devicesLegend} options={[...t.devices]} type="checkbox" />
      <Field id="times" label={t.fields.times} as="textarea" rows={3} optional />
      <Field id="more" label={t.fields.more} as="textarea" rows={4} optional helper={copy.form.privacyHelper} />
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
