import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { getSupabase } from '../../lib/supabase';
import { Field } from '../forms/Field';
import { Icon } from '../forms/Icon';
import { adminCopy as a } from '../../content/adminCopy';
import { copy } from '../../content/copy';

type Reason = keyof typeof a.login.reasons;

// The sign-in page. It never says whether an email exists: every failure gets the same words.
export default function LoginPage() {
  const supabase = getSupabase();
  const [reason, setReason] = useState<Reason | null>(null);
  const [checking, setChecking] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    const why = new URLSearchParams(window.location.search).get('why') as Reason | null;
    if (why && why in a.login.reasons) setReason(why);
    if (!supabase) {
      setChecking(false);
      return;
    }
    // Already signed in as the owner? Go straight to the dashboard.
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const { data: isOwner } = await supabase.rpc('is_owner');
        if (isOwner === true) {
          window.location.replace('/admin/dashboard');
          return;
        }
      }
      setChecking(false);
    })();
  }, []);

  async function onSubmit(event: JSX.TargetedEvent<HTMLFormElement, Event>) {
    event.preventDefault();
    if (!supabase || signingIn) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');

    const problems: { email?: string; password?: string } = {};
    if (!email) problems.email = a.login.missingEmail;
    if (!password) problems.password = a.login.missingPassword;
    setFieldErrors(problems);
    setError('');
    if (problems.email || problems.password) return;

    setSigningIn(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.status && signInError.status >= 500 ? a.login.problem : a.login.wrong);
        return;
      }
      const { data: isOwner } = await supabase.rpc('is_owner');
      if (isOwner !== true) {
        await supabase.auth.signOut();
        setReason('notowner');
        return;
      }
      window.location.assign('/admin/dashboard');
    } catch {
      setError(a.login.problem);
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main id="main" tabIndex={-1} class="admin-narrow">
      <h1>{a.login.title}</h1>
      <p class="lead">{a.login.intro}</p>
      {reason && (
        <p class="admin-message" role="status">
          {a.login.reasons[reason]}
        </p>
      )}
      {!supabase ? (
        <p role="status">{a.notConfigured}</p>
      ) : checking ? (
        <p role="status">{a.checking}</p>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <Field id="email" label={a.login.email} type="email" required autoComplete="username" error={fieldErrors.email} />
          <PasswordField error={fieldErrors.password} />
          {error && (
            <p class="field-error" role="alert">
              <Icon name="alert" size={24} />
              <span>{error}</span>
            </p>
          )}
          <button type="submit" class="button button-primary" disabled={signingIn} aria-disabled={signingIn}>
            {signingIn ? a.login.signingIn : a.login.submit}
          </button>
        </form>
      )}
    </main>
  );
}

// Field.tsx has no password type, so this small copy keeps the same look.
function PasswordField({ error }: { error?: string }) {
  const errorId = error ? 'password-error' : undefined;
  return (
    <div class="field">
      <label for="password" class="field-label">
        {a.login.password} <span class="field-required">{copy.form.required}</span>
      </label>
      <input
        id="password"
        name="password"
        type="password"
        class="field-control"
        autoComplete="current-password"
        aria-required="true"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
      />
      {error && (
        <p id={errorId} class="field-error">
          <Icon name="alert" size={24} />
          <span>
            <span class="visually-hidden">{copy.form.errorPrefix} </span>
            {error}
          </span>
        </p>
      )}
    </div>
  );
}
