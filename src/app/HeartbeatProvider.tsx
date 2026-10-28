import { useEffect, useRef, type ReactNode } from 'react';
import { usePlatform } from './usePlatform';
import { useSettings } from './useSettings';
import { useWaterToday } from './useWaterToday';
import { formatClock, phaseLabel, useTimerStore } from '@/store/timerStore';
import { useReminderStore } from '@/store/reminderStore';
import { currentPhase, remainingMs } from '@/core/pomodoro/engine';
import type { Settings } from '@/core/models';
import { toDayKey } from '@/core/time/dayKey';

/**
 * Wires the platform heartbeat to the runtime stores and mirrors the timer into the
 * window title and tray. Mounted once, inside PlatformProvider.
 */
export function HeartbeatProvider({ children }: { children: ReactNode }) {
  const platform = usePlatform();
  const settings = useSettings();
  const { totalMl } = useWaterToday();

  const settingsRef = useRef(settings);
  const waterRef = useRef(totalMl);
  useEffect(() => {
    waterRef.current = totalMl;
  }, [totalMl]);

  // Settings changes re-anchor reminder timers whose interval changed.
  useEffect(() => {
    const previous = settingsRef.current;
    settingsRef.current = settings;
    if (previous && settings && previous !== settings) {
      useReminderStore.getState().settingsChanged(previous, settings);
    }
  }, [settings]);

  // Boot the stores once the settings row exists.
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current || !settings) return;
    initialised.current = true;
    const getSettings = (): Settings | undefined => settingsRef.current;
    void useTimerStore
      .getState()
      .init({ platform, getSettings })
      .then(() =>
        useReminderStore.getState().init({
          platform,
          getSettings,
          getPomodoro: () => useTimerStore.getState().state,
          getWaterTodayMl: () => waterRef.current,
        }),
      );
  }, [platform, settings]);

  // Heartbeat → tick the timer first, then reminders (so break transitions are visible).
  const dayKeyRef = useRef<string | null>(null);
  useEffect(
    () =>
      platform.heartbeat.subscribe((now) => {
        useTimerStore.getState().tick(now);
        useReminderStore.getState().tick(now);
        const s = settingsRef.current;
        const key = toDayKey(now, s?.dayStartHour ?? 0, s?.timeZone ?? null);
        if (
          dayKeyRef.current !== null &&
          dayKeyRef.current !== key &&
          useTimerStore.getState().state.status === 'idle'
        ) {
          useTimerStore.getState().resetCycle();
        }
        dayKeyRef.current = key;
      }),
    [platform],
  );

  // A finished break restarts the break-covered reminder timers.
  useEffect(
    () =>
      useTimerStore.subscribe((cur, prev) => {
        const wasBreak =
          (prev.state.status === 'running' || prev.state.status === 'paused') &&
          prev.state.phase !== 'focus';
        const stillSameBreak =
          (cur.state.status === 'running' || cur.state.status === 'paused') &&
          cur.state.phase !== 'focus' &&
          cur.state.sessionId === (prev.state as { sessionId?: string }).sessionId;
        if (wasBreak && !stillSameBreak) useReminderStore.getState().onBreakEnded(cur.now);
      }),
    [],
  );

  return (
    <>
      <TimerMirror />
      <TrayMenu />
      {children}
    </>
  );
}

function TimerMirror() {
  const platform = usePlatform();
  const state = useTimerStore((s) => s.state);
  const now = useTimerStore((s) => s.now);
  const pausedUntil = useReminderStore((s) => s.scheduler.pausedUntil);
  const last = useRef<string>('');

  useEffect(() => {
    let title = 'Desk Wellness';
    let tray: 'idle' | 'focus' | 'break' | 'paused' = 'idle';
    if (state.status === 'running' || state.status === 'paused') {
      const clock = formatClock(remainingMs(state, now));
      const label = phaseLabel(currentPhase(state));
      title = `${clock} ${state.status === 'paused' ? '(paused) ' : ''}· ${label} · Desk Wellness`;
      tray = state.phase === 'focus' ? 'focus' : 'break';
    } else if (pausedUntil !== null && pausedUntil > now) {
      tray = 'paused';
    }
    const key = `${title}|${tray}`;
    if (key === last.current) return;
    last.current = key;
    platform.window.setTitle(title);
    void platform.tray?.setTooltip(title);
    void platform.tray?.setState(tray);
  }, [platform, state, now, pausedUntil]);

  return null;
}

/** Keeps the tray menu in sync with pause state and routes its clicks. */
function TrayMenu() {
  const platform = usePlatform();
  const settings = useSettings();
  const pausedUntil = useReminderStore((s) => s.scheduler.pausedUntil);
  const timerStatus = useTimerStore((s) => s.state.status);
  const minute = useTimerStore((s) => Math.floor(s.now / 60_000));
  const paused = pausedUntil !== null && pausedUntil > minute * 60_000;
  const quickMl = settings?.waterQuickAddMl[0] ?? 250;

  useEffect(() => {
    if (!platform.tray) return;
    void platform.tray.setMenu([
      { id: 'show', label: 'Open Desk Wellness' },
      { id: 'separator', label: '' },
      timerStatus === 'running'
        ? { id: 'timer-pause', label: 'Pause focus timer' }
        : timerStatus === 'paused'
          ? { id: 'timer-resume', label: 'Resume focus timer' }
          : { id: 'timer-start', label: 'Start focus session' },
      { id: 'log-water', label: `Log ${quickMl} ml of water` },
      paused
        ? { id: 'resume', label: 'Resume reminders' }
        : { id: 'pause-1h', label: 'Pause reminders for 1 hour' },
      { id: 'separator', label: '' },
      { id: 'quit', label: 'Quit' },
    ]);
  }, [platform, paused, timerStatus, quickMl]);

  useEffect(() => {
    if (!platform.tray) return;
    return platform.tray.onMenuClick((id) => {
      const timer = useTimerStore.getState();
      const reminders = useReminderStore.getState();
      switch (id) {
        case 'timer-start':
          timer.start('focus');
          break;
        case 'timer-pause':
          timer.pause();
          break;
        case 'timer-resume':
          timer.resume();
          break;
        case 'pause-1h':
          reminders.pauseFor(60 * 60_000);
          break;
        case 'resume':
          reminders.resume();
          break;
        case 'log-water': {
          const s = settings;
          void import('@/storage/water').then(({ addWater }) =>
            addWater(quickMl, 'manual', {
              dayStartHour: s?.dayStartHour ?? 0,
              timeZone: s?.timeZone ?? null,
            }),
          );
          break;
        }
      }
    });
  }, [platform, settings, quickMl]);

  return null;
}
