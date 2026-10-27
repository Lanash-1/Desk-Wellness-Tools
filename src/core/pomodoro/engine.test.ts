import { describe, expect, it } from 'vitest';
import {
  INITIAL_STATE,
  STALE_AUTOSTART_MS,
  nextPhaseAfter,
  pause,
  progress,
  remainingMs,
  reset,
  resume,
  skip,
  start,
  tick,
  type PomodoroConfig,
  type PomodoroContext,
  type PomodoroState,
} from './engine';

const config: PomodoroConfig = {
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
  autoStartBreak: true,
  autoStartFocus: false,
};

const MIN = 60_000;
let seq = 0;
const ctx = (now: number, overrides: Partial<PomodoroConfig> = {}): PomodoroContext => ({
  config: { ...config, ...overrides },
  now,
  newId: () => `s${++seq}`,
});

describe('start / pause / resume', () => {
  it('starts a focus phase with an absolute end time', () => {
    const { state, effects } = start(INITIAL_STATE, ctx(1_000));
    expect(state).toMatchObject({
      status: 'running',
      phase: 'focus',
      startedAt: 1_000,
      endsAt: 1_000 + 25 * MIN,
    });
    expect(effects).toEqual([
      {
        type: 'phaseStarted',
        phase: 'focus',
        sessionId: expect.any(String),
        startedAt: 1_000,
        endsAt: 1_000 + 25 * MIN,
      },
    ]);
  });

  it('is a no-op while running', () => {
    const running = start(INITIAL_STATE, ctx(0)).state;
    expect(start(running, ctx(10))).toEqual({ state: running, effects: [] });
  });

  it('pauses and resumes preserving the remaining time', () => {
    const running = start(INITIAL_STATE, ctx(0)).state;
    const paused = pause(running, ctx(10 * MIN)).state;
    expect(paused).toMatchObject({ status: 'paused', remainingMs: 15 * MIN });
    expect(remainingMs(paused, 99 * MIN)).toBe(15 * MIN); // frozen while paused

    const resumed = resume(paused, ctx(60 * MIN)).state;
    expect(resumed).toMatchObject({ status: 'running', endsAt: 75 * MIN });
    expect(progress(resumed, 60 * MIN, config)).toBeCloseTo(0.4);
  });
});

describe('tick', () => {
  it('does nothing before the end time', () => {
    const running = start(INITIAL_STATE, ctx(0)).state;
    expect(tick(running, ctx(25 * MIN - 1))).toEqual({ state: running, effects: [] });
  });

  it('completes focus and auto-starts a short break', () => {
    const running = start(INITIAL_STATE, ctx(0)).state;
    const { state, effects } = tick(running, ctx(25 * MIN + 500));
    expect(effects[0]).toMatchObject({
      type: 'phaseEnded',
      phase: 'focus',
      endedAt: 25 * MIN,
      nextPhase: 'shortBreak',
    });
    expect(effects[1]).toMatchObject({
      type: 'phaseStarted',
      phase: 'shortBreak',
      startedAt: 25 * MIN + 500,
    });
    expect(state).toMatchObject({ status: 'running', phase: 'shortBreak', completedFocus: 1 });
  });

  it('waits for the user after a break when autoStartFocus is off', () => {
    let s: PomodoroState = start(INITIAL_STATE, ctx(0)).state;
    s = tick(s, ctx(25 * MIN)).state; // → short break
    const { state, effects } = tick(s, ctx(30 * MIN));
    expect(effects).toEqual([
      {
        type: 'phaseEnded',
        phase: 'shortBreak',
        sessionId: expect.any(String),
        endedAt: 30 * MIN,
        nextPhase: 'focus',
      },
    ]);
    expect(state).toMatchObject({
      status: 'awaitingNext',
      endedPhase: 'shortBreak',
      nextPhase: 'focus',
      completedFocus: 1,
    });
  });

  it('gives a long break after every 4th focus', () => {
    expect(nextPhaseAfter('focus', 1, config)).toBe('shortBreak');
    expect(nextPhaseAfter('focus', 4, config)).toBe('longBreak');
    expect(nextPhaseAfter('focus', 8, config)).toBe('longBreak');
    expect(nextPhaseAfter('longBreak', 4, config)).toBe('focus');

    let s: PomodoroState = { status: 'idle', completedFocus: 3 };
    s = start(s, ctx(0)).state;
    const { state } = tick(s, ctx(25 * MIN));
    expect(state).toMatchObject({
      phase: 'longBreak',
      completedFocus: 4,
      endsAt: 25 * MIN + 15 * MIN,
    });
  });

  it('does not auto-start after a long sleep gap, and records the end at endsAt', () => {
    const running = start(INITIAL_STATE, ctx(0)).state;
    const { state, effects } = tick(running, ctx(25 * MIN + STALE_AUTOSTART_MS + 1));
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ type: 'phaseEnded', endedAt: 25 * MIN });
    expect(state).toMatchObject({
      status: 'awaitingNext',
      nextPhase: 'shortBreak',
      completedFocus: 1,
    });
  });

  it('starting from awaitingNext begins the suggested phase', () => {
    const awaiting: PomodoroState = {
      status: 'awaitingNext',
      endedPhase: 'focus',
      nextPhase: 'shortBreak',
      completedFocus: 1,
    };
    expect(start(awaiting, ctx(0)).state).toMatchObject({ phase: 'shortBreak' });
    expect(start(awaiting, ctx(0), 'focus').state).toMatchObject({ phase: 'focus' });
  });
});

describe('skip / reset', () => {
  it('skip abandons the current phase without counting it', () => {
    const running = start(INITIAL_STATE, ctx(0)).state;
    const { state, effects } = skip(running, ctx(5 * MIN));
    expect(effects).toEqual([
      { type: 'phaseAbandoned', phase: 'focus', sessionId: expect.any(String), endedAt: 5 * MIN },
    ]);
    expect(state).toMatchObject({
      status: 'awaitingNext',
      nextPhase: 'shortBreak',
      completedFocus: 0,
    });
  });

  it('reset returns to idle and abandons a paused phase', () => {
    const paused = pause(start(INITIAL_STATE, ctx(0)).state, ctx(MIN)).state;
    const { state, effects } = reset(paused, ctx(2 * MIN));
    expect(state).toEqual({ status: 'idle', completedFocus: 0 });
    expect(effects[0]).toMatchObject({ type: 'phaseAbandoned', endedAt: 2 * MIN });
    expect(reset(state, ctx(3 * MIN)).effects).toEqual([]);
  });
});
