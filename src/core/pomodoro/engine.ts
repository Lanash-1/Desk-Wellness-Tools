/**
 * Pomodoro state machine. Pure: every transition takes the current state plus a
 * context (config, now, id factory) and returns the next state with a list of effects
 * for the runtime to apply (persist sessions, notify, play sounds).
 *
 * Time is handled with absolute timestamps: a running phase stores `endsAt` and the UI
 * derives the remaining time from `now`, so sleep, tab throttling and DST cannot drift it.
 */

export type Phase = 'focus' | 'shortBreak' | 'longBreak';

export interface PomodoroConfig {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  longBreakEvery: number;
  autoStartBreak: boolean;
  autoStartFocus: boolean;
}

export type PomodoroState =
  | { status: 'idle'; completedFocus: number }
  | {
      status: 'running';
      phase: Phase;
      sessionId: string;
      startedAt: number;
      endsAt: number;
      completedFocus: number;
    }
  | {
      status: 'paused';
      phase: Phase;
      sessionId: string;
      startedAt: number;
      remainingMs: number;
      completedFocus: number;
    }
  | {
      status: 'awaitingNext';
      endedPhase: Phase;
      nextPhase: Phase;
      completedFocus: number;
    };

export type PomodoroEffect =
  | { type: 'phaseStarted'; phase: Phase; sessionId: string; startedAt: number; endsAt: number }
  | { type: 'phaseEnded'; phase: Phase; sessionId: string; endedAt: number; nextPhase: Phase }
  | { type: 'phaseAbandoned'; phase: Phase; sessionId: string; endedAt: number };

export interface PomodoroContext {
  config: PomodoroConfig;
  now: number;
  newId: () => string;
}

export interface TransitionResult {
  state: PomodoroState;
  effects: PomodoroEffect[];
}

/** If a phase ended longer ago than this (machine asleep), don't auto-start the next one. */
export const STALE_AUTOSTART_MS = 10 * 60 * 1000;

export const INITIAL_STATE: PomodoroState = { status: 'idle', completedFocus: 0 };

const MINUTE_MS = 60 * 1000;

function same(state: PomodoroState): TransitionResult {
  return { state, effects: [] };
}

export function phaseDurationMs(phase: Phase, config: PomodoroConfig): number {
  switch (phase) {
    case 'focus':
      return config.focusMin * MINUTE_MS;
    case 'shortBreak':
      return config.shortBreakMin * MINUTE_MS;
    case 'longBreak':
      return config.longBreakMin * MINUTE_MS;
  }
}

/** Phase that follows `phase`, given how many focus phases are complete *after* it. */
export function nextPhaseAfter(
  phase: Phase,
  completedFocus: number,
  config: PomodoroConfig,
): Phase {
  if (phase !== 'focus') return 'focus';
  const every = Math.max(1, config.longBreakEvery);
  return completedFocus > 0 && completedFocus % every === 0 ? 'longBreak' : 'shortBreak';
}

function begin(phase: Phase, completedFocus: number, ctx: PomodoroContext): TransitionResult {
  const sessionId = ctx.newId();
  const endsAt = ctx.now + phaseDurationMs(phase, ctx.config);
  return {
    state: { status: 'running', phase, sessionId, startedAt: ctx.now, endsAt, completedFocus },
    effects: [{ type: 'phaseStarted', phase, sessionId, startedAt: ctx.now, endsAt }],
  };
}

/** Starts a phase from idle/awaitingNext. No-op while running or paused. */
export function start(state: PomodoroState, ctx: PomodoroContext, phase?: Phase): TransitionResult {
  if (state.status === 'running' || state.status === 'paused') return same(state);
  const target = phase ?? (state.status === 'awaitingNext' ? state.nextPhase : 'focus');
  return begin(target, state.completedFocus, ctx);
}

export function pause(state: PomodoroState, ctx: PomodoroContext): TransitionResult {
  if (state.status !== 'running') return same(state);
  return same({
    status: 'paused',
    phase: state.phase,
    sessionId: state.sessionId,
    startedAt: state.startedAt,
    remainingMs: Math.max(0, state.endsAt - ctx.now),
    completedFocus: state.completedFocus,
  });
}

export function resume(state: PomodoroState, ctx: PomodoroContext): TransitionResult {
  if (state.status !== 'paused') return same(state);
  return same({
    status: 'running',
    phase: state.phase,
    sessionId: state.sessionId,
    startedAt: state.startedAt,
    endsAt: ctx.now + state.remainingMs,
    completedFocus: state.completedFocus,
  });
}

/**
 * Ends the current phase early. The session is recorded as abandoned (a skipped focus
 * does not count towards the long-break cadence) and the machine waits for the user to
 * start the next phase.
 */
export function skip(state: PomodoroState, ctx: PomodoroContext): TransitionResult {
  if (state.status !== 'running' && state.status !== 'paused') return same(state);
  return {
    state: {
      status: 'awaitingNext',
      endedPhase: state.phase,
      nextPhase: nextPhaseAfter(state.phase, state.completedFocus, ctx.config),
      completedFocus: state.completedFocus,
    },
    effects: [
      { type: 'phaseAbandoned', phase: state.phase, sessionId: state.sessionId, endedAt: ctx.now },
    ],
  };
}

/** Stops everything and returns to idle. The cycle count is kept. */
export function reset(state: PomodoroState, ctx: PomodoroContext): TransitionResult {
  const effects: PomodoroEffect[] =
    state.status === 'running' || state.status === 'paused'
      ? [
          {
            type: 'phaseAbandoned',
            phase: state.phase,
            sessionId: state.sessionId,
            endedAt: ctx.now,
          },
        ]
      : [];
  return { state: { status: 'idle', completedFocus: state.completedFocus }, effects };
}

/** Clears the long-break cycle count (e.g. at the start of a new day). */
export function resetCycle(state: PomodoroState): TransitionResult {
  return same({ ...state, completedFocus: 0 });
}

/**
 * Advances the clock. When a running phase has reached `endsAt` it is completed; the next
 * phase auto-starts if configured, unless the end was missed by more than
 * STALE_AUTOSTART_MS (the machine was asleep), in which case we wait for the user.
 */
export function tick(state: PomodoroState, ctx: PomodoroContext): TransitionResult {
  if (state.status !== 'running' || ctx.now < state.endsAt) return same(state);

  const completedFocus = state.phase === 'focus' ? state.completedFocus + 1 : state.completedFocus;
  const nextPhase = nextPhaseAfter(state.phase, completedFocus, ctx.config);
  const ended: PomodoroEffect = {
    type: 'phaseEnded',
    phase: state.phase,
    sessionId: state.sessionId,
    endedAt: state.endsAt,
    nextPhase,
  };

  const autoStart = state.phase === 'focus' ? ctx.config.autoStartBreak : ctx.config.autoStartFocus;
  const overdueMs = ctx.now - state.endsAt;
  if (autoStart && overdueMs <= STALE_AUTOSTART_MS) {
    const next = begin(nextPhase, completedFocus, ctx);
    return { state: next.state, effects: [ended, ...next.effects] };
  }
  return {
    state: { status: 'awaitingNext', endedPhase: state.phase, nextPhase, completedFocus },
    effects: [ended],
  };
}

export function remainingMs(state: PomodoroState, now: number): number {
  switch (state.status) {
    case 'running':
      return Math.max(0, state.endsAt - now);
    case 'paused':
      return state.remainingMs;
    default:
      return 0;
  }
}

/** 0 at phase start → 1 at phase end. 0 when not in a phase. */
export function progress(state: PomodoroState, now: number, config: PomodoroConfig): number {
  if (state.status !== 'running' && state.status !== 'paused') return 0;
  const total = phaseDurationMs(state.phase, config);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - remainingMs(state, now) / total));
}

/** Current phase, or the one the user will start next. */
export function currentPhase(state: PomodoroState): Phase {
  switch (state.status) {
    case 'running':
    case 'paused':
      return state.phase;
    case 'awaitingNext':
      return state.nextPhase;
    default:
      return 'focus';
  }
}

/**
 * Position within the long-break cycle. During a focus phase this is the 1-based index of
 * that session ("Session 2 of 4"); otherwise it is the number of focus sessions completed
 * in the current cycle ("3 of 4 done"), where a just-finished cycle shows the full count.
 */
export function cyclePosition(state: PomodoroState, config: PomodoroConfig): number {
  const every = Math.max(1, config.longBreakEvery);
  const done = state.completedFocus % every;
  const inFocus =
    (state.status === 'running' || state.status === 'paused') && state.phase === 'focus';
  if (inFocus) return done + 1;
  if (done === 0 && state.completedFocus > 0) return every;
  return done;
}
