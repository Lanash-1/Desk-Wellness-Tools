// Generates the bundled notification sounds as small 16-bit mono WAV files.
// Run: node scripts/generate-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sounds');
mkdirSync(outDir, { recursive: true });

/** @param {(t: number) => number} fn amplitude -1..1 at time t (seconds) */
function render(seconds, fn) {
  const n = Math.round(seconds * RATE);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, fn(i / RATE)));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

const env = (t, len, attack = 0.01) =>
  t < attack ? t / attack : Math.exp((-4 * (t - attack)) / len);
const sine = (f, t) => Math.sin(2 * Math.PI * f * t);

const sounds = {
  // Two-note chime: focus/break transitions.
  chime: render(0.9, (t) => {
    const a = sine(880, t) * env(t, 0.6) * 0.5;
    const b = t > 0.18 ? sine(1174.66, t - 0.18) * env(t - 0.18, 0.7) * 0.5 : 0;
    return 0.8 * (a + b);
  }),
  // Water drop: quick descending pitch.
  drop: render(0.35, (t) => {
    const f = 1400 * Math.exp(-6 * t) + 300;
    return 0.7 * sine(f, t) * env(t, 0.25, 0.005);
  }),
  // Soft single tone: gentle nudges.
  soft: render(0.5, (t) => 0.6 * (sine(523.25, t) + 0.3 * sine(1046.5, t)) * env(t, 0.4, 0.02)),
};

for (const [name, data] of Object.entries(sounds)) {
  writeFileSync(join(outDir, `${name}.wav`), data);
  console.log(`wrote ${name}.wav (${data.length} bytes)`);
}
