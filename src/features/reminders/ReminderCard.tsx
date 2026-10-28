import { Button } from '@/components/Button';
import { REMINDER_LABELS } from '@/core/settings/defaults';
import type { ReminderKind } from '@/core/models';
import { useReminderStore } from '@/store/reminderStore';
import { useTimerStore } from '@/store/timerStore';
import { useSettings } from '@/app/useSettings';

const EYE_REST_SECONDS = 20;

const ICON: Record<ReminderKind, string> = {
  water: '💧',
  move: '🚶',
  eyes: '👀',
  stretch: '🧘',
  posture: '🪑',
};

/**
 * In-app reminder card. This is the primary way to answer a reminder; the OS notification
 * is a pointer back to it. Rendered once in the app layout.
 */
export function ReminderCard() {
  const active = useReminderStore((s) => s.active);
  const respond = useReminderStore((s) => s.respond);
  const now = useTimerStore((s) => s.now);
  const settings = useSettings();

  if (!active) return null;
  const elapsedSec = Math.floor((now - active.firedAt) / 1000);
  const eyeLeft = Math.max(0, EYE_REST_SECONDS - elapsedSec);

  return (
    <aside
      role="dialog"
      aria-live="assertive"
      aria-label="Reminder"
      data-testid="reminder-card"
      className="fixed right-4 bottom-20 z-50 w-[min(92vw,22rem)] rounded-2xl border border-brand-200 bg-white p-4 shadow-xl md:bottom-6 dark:border-brand-900 dark:bg-slate-900"
    >
      <ul className="space-y-3">
        {active.kinds.map((kind) => (
          <li key={kind} className="flex items-start gap-3">
            <span aria-hidden className="text-2xl leading-none">
              {ICON[kind]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{REMINDER_LABELS[kind].title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {kind === 'eyes' && eyeLeft > 0
                  ? `Look at something far away… ${eyeLeft}s`
                  : REMINDER_LABELS[kind].body}
              </p>
            </div>
            {active.kinds.length > 1 && (
              <button
                type="button"
                className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-100 dark:hover:bg-brand-900/40"
                onClick={() => respond(kind, 'done')}
                aria-label={`Done: ${REMINDER_LABELS[kind].title}`}
              >
                Done
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => respond('all', 'dismiss')}>
          Dismiss
        </Button>
        <Button variant="secondary" onClick={() => respond('all', 'snooze')}>
          Snooze {settings?.snoozeMin ?? 5} min
        </Button>
        <Button onClick={() => respond('all', 'done')}>
          {active.kinds.length > 1 ? 'All done' : 'Done'}
        </Button>
      </div>
    </aside>
  );
}
