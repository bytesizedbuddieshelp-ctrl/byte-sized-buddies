import { useEffect, useState } from 'preact/hooks';
import { adminCopy as a } from '../../content/adminCopy';
import { readTicks, ROUTINE_KEY, toggleTick, weekStart, writeTicks } from '../../lib/weekly';

const d = a.dashboard;

// The week's routine as boxes to tick. Kept in this browser only, and cleared every Monday.
export function WeeklyRoutine() {
  const week = weekStart(new Date());
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    try {
      setDone(readTicks(localStorage.getItem(ROUTINE_KEY), week));
    } catch {
      // Storage may be blocked. The boxes still work until the page closes.
    }
  }, []);

  function change(next: string[]) {
    setDone(next);
    try {
      localStorage.setItem(ROUTINE_KEY, writeTicks(week, next));
    } catch {
      // Not saved. The ticks stay for now.
    }
  }

  const total = d.routine.length;
  return (
    <section class="admin-box" aria-labelledby="routine-title">
      <h2 id="routine-title">{d.routineHeading}</h2>
      <p>{d.routineHelp}</p>
      <ul class="tick-list">
        {d.routine.map((item) => (
          <li key={item.id}>
            <label>
              <input type="checkbox" checked={done.includes(item.id)} onChange={() => change(toggleTick(done, item.id))} />
              <span>{item.label}</span>
            </label>
            {item.href && (
              <a class="routine-link" href={item.href}>
                {d.open}
                <span class="visually-hidden">: {item.label}</span>
              </a>
            )}
          </li>
        ))}
      </ul>
      <p class="counter" role="status">
        {done.length === total ? d.routineDone : d.routineProgress(done.length, total)}
      </p>
      {done.length > 0 && (
        <button type="button" class="button button-secondary" onClick={() => change([])}>
          {d.routineReset}
        </button>
      )}
    </section>
  );
}
