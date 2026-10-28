/**
 * Built-in stretch library. Short, equipment-free movements that fit a desk break.
 * Durations are suggestions; the reminder card shows the steps as a checklist.
 */

export type StretchArea = 'neck' | 'shoulders' | 'wrists' | 'back' | 'hips' | 'legs' | 'eyes';

export interface Stretch {
  id: string;
  title: string;
  area: StretchArea;
  seconds: number;
  steps: string[];
}

export const STRETCHES: readonly Stretch[] = [
  {
    id: 'neck-tilt',
    title: 'Neck tilts',
    area: 'neck',
    seconds: 40,
    steps: [
      'Sit tall, shoulders relaxed.',
      'Tilt your right ear toward your right shoulder; hold 15 s.',
      'Repeat on the left.',
    ],
  },
  {
    id: 'neck-rotation',
    title: 'Slow neck turns',
    area: 'neck',
    seconds: 30,
    steps: [
      'Turn your head slowly to look over one shoulder.',
      'Hold 5 s, return to centre.',
      'Repeat 3 times each side.',
    ],
  },
  {
    id: 'chin-tuck',
    title: 'Chin tucks',
    area: 'neck',
    seconds: 30,
    steps: [
      'Look straight ahead.',
      'Glide your chin straight back, making a double chin.',
      'Hold 5 s, release. Repeat 5 times.',
    ],
  },
  {
    id: 'shoulder-rolls',
    title: 'Shoulder rolls',
    area: 'shoulders',
    seconds: 30,
    steps: [
      'Roll both shoulders up, back and down 10 times.',
      'Then 10 times forward.',
      'Let your arms hang loose.',
    ],
  },
  {
    id: 'shoulder-blade-squeeze',
    title: 'Shoulder blade squeeze',
    area: 'shoulders',
    seconds: 40,
    steps: [
      'Arms by your sides, elbows bent at 90°.',
      'Squeeze your shoulder blades together; hold 5 s.',
      'Release. Repeat 8 times.',
    ],
  },
  {
    id: 'cross-body-shoulder',
    title: 'Cross-body shoulder stretch',
    area: 'shoulders',
    seconds: 40,
    steps: [
      'Bring one arm across your chest.',
      'Hold it with the other hand just above the elbow; hold 20 s.',
      'Switch arms.',
    ],
  },
  {
    id: 'wrist-flexor',
    title: 'Wrist flexor stretch',
    area: 'wrists',
    seconds: 40,
    steps: [
      'Extend one arm, palm up.',
      'Gently pull the fingers back with your other hand; hold 20 s.',
      'Switch hands.',
    ],
  },
  {
    id: 'wrist-extensor',
    title: 'Wrist extensor stretch',
    area: 'wrists',
    seconds: 40,
    steps: [
      'Extend one arm, palm down.',
      'Gently press the back of the hand toward you; hold 20 s.',
      'Switch hands.',
    ],
  },
  {
    id: 'finger-fan',
    title: 'Finger fans and fists',
    area: 'wrists',
    seconds: 30,
    steps: [
      'Spread your fingers wide for 5 s.',
      'Make a loose fist for 5 s.',
      'Repeat 5 times, then shake your hands out.',
    ],
  },
  {
    id: 'seated-twist',
    title: 'Seated spinal twist',
    area: 'back',
    seconds: 40,
    steps: [
      'Sit tall, feet flat.',
      'Place your right hand on the chair back and twist gently right; hold 20 s.',
      'Repeat left.',
    ],
  },
  {
    id: 'cat-cow-seated',
    title: 'Seated cat-cow',
    area: 'back',
    seconds: 40,
    steps: [
      'Hands on knees.',
      'Inhale: arch your back and look up.',
      'Exhale: round your back and tuck your chin. Repeat 6 times.',
    ],
  },
  {
    id: 'standing-back-bend',
    title: 'Standing back extension',
    area: 'back',
    seconds: 30,
    steps: [
      'Stand up, hands on your lower back.',
      'Gently lean back and look up; hold 5 s.',
      'Return upright. Repeat 5 times.',
    ],
  },
  {
    id: 'hip-flexor',
    title: 'Standing hip flexor stretch',
    area: 'hips',
    seconds: 40,
    steps: [
      'Step one foot back into a small lunge.',
      'Tuck your pelvis and lean slightly forward; hold 20 s.',
      'Switch legs.',
    ],
  },
  {
    id: 'figure-four',
    title: 'Seated figure-four',
    area: 'hips',
    seconds: 40,
    steps: [
      'Cross your right ankle over your left knee.',
      'Sit tall and lean forward slightly; hold 20 s.',
      'Switch sides.',
    ],
  },
  {
    id: 'calf-raises',
    title: 'Calf raises',
    area: 'legs',
    seconds: 30,
    steps: [
      'Stand, holding the desk for balance.',
      'Rise onto your toes, pause, lower slowly.',
      'Repeat 15 times.',
    ],
  },
  {
    id: 'hamstring-desk',
    title: 'Desk hamstring stretch',
    area: 'legs',
    seconds: 40,
    steps: [
      'Place one heel on a low surface, leg straight.',
      'Hinge forward from the hips; hold 20 s.',
      'Switch legs.',
    ],
  },
  {
    id: 'eye-palming',
    title: 'Palming',
    area: 'eyes',
    seconds: 30,
    steps: [
      'Rub your palms together until warm.',
      'Cup them over closed eyes without pressing.',
      'Breathe slowly for 30 s.',
    ],
  },
];

/** Deterministic rotation so consecutive prompts cover different areas. */
export function pickStretch(seed: number, exclude: string[] = []): Stretch {
  const pool = STRETCHES.filter((s) => !exclude.includes(s.id));
  const list = pool.length > 0 ? pool : STRETCHES;
  const index = Math.abs(Math.floor(seed)) % list.length;
  return list[index];
}

/** Picks a stretch using the day and how many prompts have been shown today. */
export function stretchForPrompt(dayKey: string, promptIndex: number): Stretch {
  const daySeed = dayKey.split('-').reduce((acc, part) => acc * 31 + Number(part), 7);
  // Step by a number coprime with the library size so one day's sequence visits each entry.
  const step = 7;
  return STRETCHES[(daySeed + promptIndex * step) % STRETCHES.length];
}
