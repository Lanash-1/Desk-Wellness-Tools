import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { ProgressRing } from '@/components/ProgressRing';
import { useSettings } from '@/app/useSettings';
import { DEFAULT_SETTINGS } from '@/core/settings/defaults';
import { currentPhase, cyclePosition, progress, remainingMs } from '@/core/pomodoro/engine';
import { formatClock, phaseLabel, useTimerStore } from '@/store/timerStore';

export function TimerPage() {
  const settings = useSettings();
  const cfg = settings?.pomodoro ?? DEFAULT_SETTINGS.pomodoro;
  const state = useTimerStore((s) => s.state);
  const now = useTimerStore((s) => s.now);
  const { start, pause, resume, skip, reset } = useTimerStore.getState();

  const phase = currentPhase(state);
  const inPhase = state.status === 'running' || state.status === 'paused';
  const remaining = inPhase
    ? remainingMs(state, now)
    : (phase === 'focus'
        ? cfg.focusMin
        : phase === 'longBreak'
          ? cfg.longBreakMin
          : cfg.shortBreakMin) * 60_000;
  const position = cyclePosition(state, cfg);

  const caption =
    state.status === 'idle'
      ? `Session ${position + 1} of ${cfg.longBreakEvery}`
      : state.status === 'awaitingNext'
        ? state.endedPhase === 'focus'
          ? `Focus complete · ${position} of ${cfg.longBreakEvery} done`
          : 'Break over · ready when you are'
        : phase === 'focus'
          ? `Session ${position} of ${cfg.longBreakEvery}`
          : `${position} of ${cfg.longBreakEvery} done`;

  return (
    <>
      <PageHeader title="Focus timer" subtitle="Pomodoro sessions with automatic breaks." />
      <Card>
        <div className="flex flex-col items-center gap-6">
          <ProgressRing
            progress={progress(state, now, cfg)}
            label={`${phaseLabel(phase)} progress`}
          >
            <div className="text-center">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                {phaseLabel(phase)}
              </p>
              <p className="font-mono text-6xl tabular-nums" data-testid="timer-clock">
                {formatClock(remaining)}
              </p>
              <p className="mt-1 text-sm text-slate-500">{caption}</p>
            </div>
          </ProgressRing>

          <div className="flex flex-wrap justify-center gap-2">
            {state.status === 'idle' && <Button onClick={() => start('focus')}>Start focus</Button>}
            {state.status === 'awaitingNext' && (
              <>
                <Button onClick={() => start()}>
                  Start {phaseLabel(state.nextPhase).toLowerCase()}
                </Button>
                {state.nextPhase !== 'focus' && (
                  <Button variant="secondary" onClick={() => start('focus')}>
                    Skip break
                  </Button>
                )}
              </>
            )}
            {state.status === 'running' && (
              <Button variant="secondary" onClick={pause}>
                Pause
              </Button>
            )}
            {state.status === 'paused' && <Button onClick={resume}>Resume</Button>}
            {inPhase && (
              <>
                <Button variant="secondary" onClick={skip}>
                  Skip
                </Button>
                <Button variant="ghost" onClick={reset}>
                  Stop
                </Button>
              </>
            )}
          </div>

          <p className="text-center text-xs text-slate-500">
            {cfg.focusMin} min focus · {cfg.shortBreakMin} min break · {cfg.longBreakMin} min long
            break every {cfg.longBreakEvery} sessions
          </p>
        </div>
      </Card>
    </>
  );
}
