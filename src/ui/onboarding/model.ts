/** `n` distinct positions in [0, total), sorted, for the recovery-word check. */
export function pickPositions(n: number, total: number, rand: () => number): number[] {
  const pool = Array.from({ length: total }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n).sort((a, b) => a - b);
}
