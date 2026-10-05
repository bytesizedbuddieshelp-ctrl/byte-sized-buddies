import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface Props {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: ComponentChildren;
}

// A question the owner must answer before something permanent or public happens.
// The browser's own dialog keeps focus inside, closes on Escape, and returns focus afterwards.
export function ConfirmDialog({ open, title, confirmLabel, cancelLabel, danger, onConfirm, onCancel, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
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
      <div class="button-row">
        <button type="button" class="button button-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" class={`button ${danger ? 'button-danger' : 'button-primary'}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
