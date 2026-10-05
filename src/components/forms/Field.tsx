import { Icon } from './Icon';
import { copy } from '../../content/copy';

interface FieldProps {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'tel';
  as?: 'input' | 'textarea';
  required?: boolean;
  optional?: boolean;
  helper?: string;
  error?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'email' | 'tel';
  rows?: number;
  maxLength?: number;
}

// A labeled field. The label is always visible. Errors use words and an icon.
export function Field({
  id,
  label,
  type = 'text',
  as = 'input',
  required,
  optional,
  helper,
  error,
  autoComplete,
  inputMode,
  rows = 4,
  maxLength,
}: FieldProps) {
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(' ') || undefined;
  const shared = {
    id,
    name: id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? ('true' as const) : undefined,
    'aria-required': required ? ('true' as const) : undefined,
    class: 'field-control',
    maxLength,
  };

  return (
    <div class="field">
      <label for={id} class="field-label">
        {label}
        {required && <span class="field-required"> {copy.form.required}</span>}
        {optional && <span class="field-required"> {copy.form.optional}</span>}
      </label>
      {helper && (
        <p id={helperId} class="field-helper">
          {helper}
        </p>
      )}
      {as === 'textarea' ? (
        <textarea {...shared} rows={rows} />
      ) : (
        <input {...shared} type={type} autoComplete={autoComplete} inputMode={inputMode} />
      )}
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
