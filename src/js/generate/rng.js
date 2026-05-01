/** @param {number} seed @returns {() => number} deterministic RNG returning [0, 1) */
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function rng() {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** @returns {number} unsigned 32-bit integer */
export function randomSeed() {
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}

/** @template T @param {() => number} rng @param {T[]} arr @returns {T|undefined} */
export function pick(rng, arr) {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

/** @template T @param {() => number} rng @param {T[]} items @param {number[]} weights @returns {T} */
export function weighted(rng, items, weights) {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
