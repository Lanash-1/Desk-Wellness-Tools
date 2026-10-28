import { useEffect, useRef, useState } from 'react';
import { nextDayStart, useReminderStore } from '@/store/reminderStore';
import { useTimerStore } from '@/store/timerStore';

const OPTIONS: { label: string; ms: number }[] = [
  { label: '30 minutes', ms: 30 * 60_000 },
  { label: '1 hour', ms: 60 * 60_000 },
  { label: '2 hours', ms: 2 * 60 * 60_000 },
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** "Pause reminders" dropdown; shows the resume time while paused. */
export function PauseMenu() {
  const pausedUntil = useReminderStore((s) => s.scheduler.pausedUntil);
  const pauseFor = useReminderStore((s) => s.pauseFor);
  const pauseUntil = useReminderStore((s) => s.pauseUntil);
  const resume = useReminderStore((s) => s.resume);
  const now = useTimerStore((s) => s.now);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const paused = pausedUntil !== null && pausedUntil > now;

  if (paused) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          Reminders paused until {formatTime(pausedUntil)}
        </span>
        <button
          type="button"
          className="font-medium text-brand-700 hover:underline dark:text-brand-100"
          onClick={resume}
        >
          Resume
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Pause reminders
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-800 dark:bg-slate-900"
        >
          {OPTIONS.map((o) => (
            <li key={o.label} role="none">
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => {
                  pauseFor(o.ms);
                  setOpen(false);
                }}
              >
                For {o.label}
              </button>
            </li>
          ))}
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => {
                pauseUntil(nextDayStart(Date.now()));
                setOpen(false);
              }}
            >
              Until tomorrow
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
