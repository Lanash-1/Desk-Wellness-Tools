import { describe, expect, it } from 'vitest';
import { STRETCHES, pickStretch, stretchForPrompt } from './stretches';

describe('stretch library', () => {
  it('has unique ids and sensible content', () => {
    const ids = new Set(STRETCHES.map((s) => s.id));
    expect(ids.size).toBe(STRETCHES.length);
    expect(STRETCHES.length).toBeGreaterThanOrEqual(15);
    for (const s of STRETCHES) {
      expect(s.steps.length).toBeGreaterThanOrEqual(2);
      expect(s.seconds).toBeGreaterThan(0);
    }
  });

  it('rotates deterministically through the library within a day', () => {
    const seen = new Set<string>();
    for (let i = 0; i < STRETCHES.length; i++) seen.add(stretchForPrompt('2026-10-27', i).id);
    expect(seen.size).toBe(STRETCHES.length);
    expect(stretchForPrompt('2026-10-27', 2)).toEqual(stretchForPrompt('2026-10-27', 2));
    expect(stretchForPrompt('2026-10-27', 0).id).not.toBe(stretchForPrompt('2026-10-28', 0).id);
  });

  it('pickStretch honours exclusions', () => {
    const first = pickStretch(3);
    const next = pickStretch(3, [first.id]);
    expect(next.id).not.toBe(first.id);
  });
});
