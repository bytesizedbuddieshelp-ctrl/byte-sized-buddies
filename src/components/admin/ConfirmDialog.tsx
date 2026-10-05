import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface Props {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** When set, the owner must type this text before the confirm button works (used for deleting a lesson). */
  requireText?: string;
  requireLabel?: string;
  children: ComponentChildren;
}

// A question the owner must answer before something permanent or public happens.
// The browser's own dialog keeps focus inside, closes on Escape, and returns focus afterwards.
export function ConfirmDialog({ open, title, confirmLabel, cancelLabel, danger, onConfirm, onCancel, requireText, requireLabel, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open) setTyped('');
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      class="confirm-dialog"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      {children}
      {requireText !== undefined && (
        <div class="field">
          <label class="field-label" for="confirm-typed">
            {requireLabel}
          </label>
          <p class="field-helper">{requireText}</p>
          <input id="confirm-typed" class="field-control" type="text" value={typed} autoComplete="off" onInput={(e) => setTyped(e.currentTarget.value)} />
        </div>
      )}
      <div class="button-row">
        <button type="button" class="button button-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          class={`button ${danger ? 'button-danger' : 'button-primary'}`}
          disabled={requireText !== undefined && typed.trim() !== requireText}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
