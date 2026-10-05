import { useEffect, useRef } from 'preact/hooks';
import { Icon } from './Icon';
import { copy } from '../../content/copy';

export interface FormProblem {
  id: string;
  label: string;
  message: string;
}

// Shown at the top of the form after a failed send. It takes focus so screen readers read it.
export function ErrorSummary({ problems, focusSignal }: { problems: FormProblem[]; focusSignal: number }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (problems.length > 0) box.current?.focus();
  }, [focusSignal]);

  if (problems.length === 0) return null;

  return (
    <div ref={box} class="error-summary" tabIndex={-1} aria-labelledby="error-summary-title">
      <h2 id="error-summary-title" class="error-summary-title">
        <Icon name="alert" size={28} />
        <span>{copy.form.summaryTitle}</span>
      </h2>
      <ul>
        {problems.map((problem) => (
          <li key={problem.id}>
            <a href={`#${problem.id}`}>
              {problem.label}: {problem.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
