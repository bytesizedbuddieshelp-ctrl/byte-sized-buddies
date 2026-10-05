import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Field } from './Field';
import { ChoiceGroup } from './ChoiceGroup';
import { ErrorSummary, type FormProblem } from './ErrorSummary';
import { copy } from '../../content/copy';
import { isValidEmail, lengthBetween } from '../../lib/validators';

type Errors = Partial<Record<'name' | 'email' | 'question', string>>;

const t = copy.ask;

// The "Ask a question" form. Phase 1: it checks the answers but does not send them yet.
export default function AskForm() {
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
    if (found.length > 0) {
      setStatus('');
      setFocusSignal((n) => n + 1);
      return;
    }
    // Phase 2 connects this to the database and makes the private answer link.
    setStatus(copy.form.notConnected);
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
      <button type="submit" class="button button-primary">
        {t.submit}
      </button>
      <div class="form-status" role="status">
        {status}
      </div>
    </form>
  );
}
