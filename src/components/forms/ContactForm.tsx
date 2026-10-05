import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Field } from './Field';
import { ChoiceGroup } from './ChoiceGroup';
import { ErrorSummary, type FormProblem } from './ErrorSummary';
import { copy } from '../../content/copy';
import { isValidEmail } from '../../lib/validators';

type Errors = Partial<Record<'name' | 'facility' | 'email', string>>;

const t = copy.homes;

// The "Request a visit" form. Phase 1: it checks the answers but does not send them yet.
export default function ContactForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [problems, setProblems] = useState<FormProblem[]>([]);
  const [focusSignal, setFocusSignal] = useState(0);
  const [status, setStatus] = useState('');

  function onSubmit(event: JSX.TargetedEvent<HTMLFormElement, Event>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? '').trim();

    const found: FormProblem[] = [];
    if (!value('name')) found.push({ id: 'name', label: t.fields.name, message: copy.form.errors.name });
    if (!value('facility')) found.push({ id: 'facility', label: t.fields.facility, message: copy.form.errors.facility });
    if (!isValidEmail(value('email'))) found.push({ id: 'email', label: t.fields.email, message: copy.form.errors.email });

    setErrors(Object.fromEntries(found.map((p) => [p.id, p.message])) as Errors);
    setProblems(found);
    if (found.length > 0) {
      setStatus('');
      setFocusSignal((n) => n + 1);
      return;
    }
    // Phase 2 connects this to the database. Until then we say so plainly.
    setStatus(copy.form.notConnected);
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
      <button type="submit" class="button button-primary">
        {t.submit}
      </button>
      <div class="form-status" role="status">
        {status}
      </div>
    </form>
  );
}
