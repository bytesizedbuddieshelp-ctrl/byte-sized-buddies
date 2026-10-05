// Two message areas that are always on the page, so screen readers hear changes.
// Good news is spoken politely. Problems are spoken right away. An empty area is hidden.
export function Notices({ ok, problem }: { ok: string; problem: string }) {
  return (
    <div>
      <div class="admin-message" role="status">
        {ok}
      </div>
      <div class="admin-message is-error" role="alert">
        {problem}
      </div>
    </div>
  );
}
