import { create } from 'zustand';
import type { Settings } from '@/core/models';
import {
  INITIAL_STATE,
  pause as enginePause,
  reset as engineReset,
  resetCycle as engineResetCycle,
  resume as engineResume,
  skip as engineSkip,
  start as engineStart,
  tick as engineTick,
  type Phase,
  type PomodoroConfig,
  type PomodoroContext,
  type PomodoroEffect,
  type PomodoroState,
  type TransitionResult,
} from '@/core/pomodoro/engine';
import { DEFAULT_SETTINGS } from '@/core/settings/defaults';
import { toDayKey } from '@/core/time/dayKey';
import type { Platform } from '@/platform';
import { getDb, newId } from '@/storage/db';
import { sessionsRepo } from '@/storage/repositories';

/** meta-table key holding the in-flight pomodoro state for restart recovery. */
export const POMODORO_STATE_KEY = 'pomodoroState';

/** A gap between heartbeats longer than this means the machine slept or the tab was frozen. */
export const SLEEP_GAP_MS = 10_000;

export interface TimerDeps {
  platform: Platform;
  getSettings: () => Settings | undefined;
}

interface TimerStore {
  state: PomodoroState;
  now: number;
  lastTickAt: number | null;
  ready: boolean;
  /** Set once by HeartbeatProvider; loads persisted state. */
  init(deps: TimerDeps): Promise<void>;
  tick(now: number): void;
  start(phase?: Phase): void;
  pause(): void;
  resume(): void;
  skip(): void;
  reset(): void;
  /** Clears the long-break cycle count (called when the day changes). */
  resetCycle(): void;
}

let deps: TimerDeps | null = null;

function config(): PomodoroConfig {
  return deps?.getSettings()?.pomodoro ?? DEFAULT_SETTINGS.pomodoro;
}

function context(now: number): PomodoroContext {
  return { config: config(), now, newId };
}

const PHASE_LABEL: Record<Phase, string> = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
};

async function persistState(state: PomodoroState): Promise<void> {
  await getDb().meta.put({ key: POMODORO_STATE_KEY, value: JSON.stringify(state) });
}

async function loadState(): Promise<PomodoroState> {
  const row = await getDb().meta.get(POMODORO_STATE_KEY);
  if (!row) return INITIAL_STATE;
  try {
    return JSON.parse(row.value) as PomodoroState;
  } catch {
    return INITIAL_STATE;
  }
}

function sessionDayKey(ts: number): string {
  const s = deps?.getSettings();
  return toDayKey(ts, s?.dayStartHour ?? 0, s?.timeZone ?? null);
}

async function applyEffect(effect: PomodoroEffect): Promise<void> {
  const settings = deps?.getSettings();
  const platform = deps?.platform;
  const cfg = config();

  switch (effect.type) {
    case 'phaseStarted':
      await sessionsRepo.put({
        id: effect.sessionId,
        type: effect.phase,
        startedAt: effect.startedAt,
        endsAt: effect.endsAt,
        endedAt: null,
        status: 'running',
        dayKey: sessionDayKey(effect.startedAt),
        label: null,
      });
      return;

    case 'phaseEnded': {
      await sessionsRepo.update(effect.sessionId, { endedAt: effect.endedAt, status: 'completed' });
      if (!platform) return;
      const nextMinutes =
        effect.nextPhase === 'focus'
          ? cfg.focusMin
          : effect.nextPhase === 'longBreak'
            ? cfg.longBreakMin
            : cfg.shortBreakMin;
      const notification =
        effect.phase === 'focus'
          ? {
              title: 'Focus session complete',
              body: `Nice work. Time for a ${nextMinutes}-minute ${effect.nextPhase === 'longBreak' ? 'long ' : ''}break.`,
            }
          : {
              title: "Break's over",
              body: `Ready for the next ${nextMinutes}-minute focus session?`,
            };
      await platform.notifications.show({ id: `pomodoro:${effect.sessionId}`, ...notification });
      if (settings?.sound.enabled ?? true) {
        await platform.audio.play(
          effect.phase === 'focus' ? 'chime' : 'soft',
          settings?.sound.volume ?? 0.6,
        );
      }
      return;
    }

    case 'phaseAbandoned':
      await sessionsRepo.update(effect.sessionId, { endedAt: effect.endedAt, status: 'abandoned' });
      return;
  }
}

export const useTimerStore = create<TimerStore>((set, get) => {
  function commit(result: TransitionResult, now: number): void {
    if (result.state !== get().state) {
      set({ state: result.state, now });
      void persistState(result.state);
    } else {
      set({ now });
    }
    for (const effect of result.effects) void applyEffect(effect);
  }

  return {
    state: INITIAL_STATE,
    now: Date.now(),
    lastTickAt: null,
    ready: false,

    async init(d) {
      deps = d;
      const state = await loadState();
      set({ state, ready: true });
      // Reconcile immediately: a phase may have ended while the app was closed.
      get().tick(Date.now());
    },

    tick(now) {
      const { state, lastTickAt } = get();
      if (lastTickAt !== null && now - lastTickAt > SLEEP_GAP_MS) {
        // Woke from sleep; the engine's stale rule decides whether to auto-start.
        set({ lastTickAt: now });
      } else {
        set({ lastTickAt: now });
      }
      commit(engineTick(state, context(now)), now);
    },

    start(phase) {
      const now = Date.now();
      commit(engineStart(get().state, context(now), phase), now);
    },
    pause() {
      const now = Date.now();
      commit(enginePause(get().state, context(now)), now);
    },
    resume() {
      const now = Date.now();
      commit(engineResume(get().state, context(now)), now);
    },
    skip() {
      const now = Date.now();
      commit(engineSkip(get().state, context(now)), now);
    },
    reset() {
      const now = Date.now();
      commit(engineReset(get().state, context(now)), now);
    },
    resetCycle() {
      const now = Date.now();
      commit(engineResetCycle(get().state), now);
    },
  };
});

export function phaseLabel(phase: Phase): string {
  return PHASE_LABEL[phase];
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Test hook. */
export function _resetTimerStoreForTests(): void {
  deps = null;
  useTimerStore.setState({ state: INITIAL_STATE, now: Date.now(), lastTickAt: null, ready: false });
}
