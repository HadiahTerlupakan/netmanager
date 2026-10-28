/**
 * Pengacak deterministik (mulberry32): seed yang sama selalu menghasilkan set
 * contoh yang sama, jadi hasil generate bisa diperiksa ulang dan diuji.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

/** Bilangan bulat acak di antara min dan max, termasuk keduanya. */
export function between(min: number, max: number, random: () => number) {
  return min + Math.floor(random() * (max - min + 1));
}
