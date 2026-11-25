const smoothstep = value => {
  const x = Math.min(1, Math.max(0, value));
  return x * x * (3 - 2 * x);
};
const random = seed => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
};

// Slow passing-cloud envelopes separated by clear spells. Different onset,
// depth and recovery each cycle keep the light from pulsing like a metronome.
// This changes one existing light scalar; it needs no textures or render pass.
export function cloudSunFactor(elapsed, night = 0, motion = true) {
  if (!motion || !Number.isFinite(elapsed) || elapsed < 0) return 1;
  const daylight = 1 - smoothstep((night - .10) / .60);
  if (daylight === 0) return 1;
  const cycle = Math.floor(elapsed / 36), local = elapsed - cycle * 36;
  const onset = cycle === 0 ? 2 : 2 + 7 * random(cycle * 5);
  const fade = cycle === 0 ? 6 : 5 + 4 * random(cycle * 5 + 1);
  const hold = cycle === 0 ? 2 : 1 + 2 * random(cycle * 5 + 2);
  const recover = cycle === 0 ? 8 : 6 + 4 * random(cycle * 5 + 3);
  const depth = cycle === 0 ? .11 : .07 + .05 * random(cycle * 5 + 4);
  const shade = smoothstep((local - onset) / fade)
    * (1 - smoothstep((local - onset - fade - hold) / recover));
  return 1 - depth * daylight * shade;
}
