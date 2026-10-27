import { useEffect, useRef, type ReactNode } from 'react';
import { usePlatform } from './usePlatform';
import { useSettings } from './useSettings';
import { formatClock, phaseLabel, useTimerStore } from '@/store/timerStore';
import { currentPhase, remainingMs } from '@/core/pomodoro/engine';

/**
 * Wires the platform heartbeat to the runtime stores and mirrors the timer into the
 * window title and tray. Mounted once, inside PlatformProvider.
 */
export function HeartbeatProvider({ children }: { children: ReactNode }) {
  const platform = usePlatform();
  const settings = useSettings();
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Boot the timer store once the settings row exists.
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current || !settings) return;
    initialised.current = true;
    void useTimerStore.getState().init({ platform, getSettings: () => settingsRef.current });
  }, [platform, settings]);

  // Heartbeat → tick.
  useEffect(
    () => platform.heartbeat.subscribe((now) => useTimerStore.getState().tick(now)),
    [platform],
  );

  return (
    <>
      <TimerMirror />
      {children}
    </>
  );
}

function TimerMirror() {
  const platform = usePlatform();
  const state = useTimerStore((s) => s.state);
  const now = useTimerStore((s) => s.now);
  const last = useRef<string>('');

  useEffect(() => {
    let title = 'Desk Wellness';
    let tray: 'idle' | 'focus' | 'break' = 'idle';
    if (state.status === 'running' || state.status === 'paused') {
      const clock = formatClock(remainingMs(state, now));
      const label = phaseLabel(currentPhase(state));
      title = `${clock} ${state.status === 'paused' ? '(paused) ' : ''}· ${label} · Desk Wellness`;
      tray = state.phase === 'focus' ? 'focus' : 'break';
    }
    if (title === last.current) return;
    last.current = title;
    platform.window.setTitle(title);
    void platform.tray?.setTooltip(title);
    void platform.tray?.setState(tray);
  }, [platform, state, now]);

  return null;
}
