import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { useSettings } from '@/app/useSettings';

export function TimerPage() {
  const settings = useSettings();
  const p = settings?.pomodoro;
  return (
    <>
      <PageHeader title="Focus timer" subtitle="Pomodoro sessions with automatic breaks." />
      <Card>
        <p className="text-center font-mono text-6xl tabular-nums">
          {p ? `${String(p.focusMin).padStart(2, '0')}:00` : '--:--'}
        </p>
        <p className="mt-2 text-center text-sm text-slate-500">
          {p
            ? `${p.focusMin} min focus · ${p.shortBreakMin} min break · long break every ${p.longBreakEvery}`
            : ''}
        </p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled
            className="rounded-full bg-brand-600 px-6 py-2 font-medium text-white opacity-60"
            title="Coming in the next milestone"
          >
            Start focus
          </button>
        </div>
      </Card>
    </>
  );
}
