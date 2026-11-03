/** Unbiased random integer in [1, sides] using the platform CSPRNG. */
export function rollDie(sides) {
  const n = Math.max(1, Math.floor(sides));
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const limit = Math.floor(0x100000000 / n) * n; // rejection sampling avoids modulo bias
    const buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return (buf[0] % n) + 1;
  }
  return Math.floor(Math.random() * n) + 1;
}

/** Random index in [0, length). */
export function randomIndex(length) {
  return rollDie(length) - 1;
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
