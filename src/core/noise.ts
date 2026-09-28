import { makeRng } from './rng';

/** 二维 value noise（置换表实现），返回 [0,1] */
export function makeValueNoise(seed: number): (x: number, y: number) => number {
  const rng = makeRng(seed * 7919 + 17);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) vals[i] = rng();
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = fade(xf), v = fade(yf);
    const X = xi & 255, Y = yi & 255;
    const a = vals[perm[perm[X] + Y]];
    const b = vals[perm[perm[X + 1] + Y]];
    const c = vals[perm[perm[X] + Y + 1]];
    const d = vals[perm[perm[X + 1] + Y + 1]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** 分形叠加的 value noise，返回 [0,1] 附近 */
export function fbm(noise: (x: number, y: number) => number, x: number, y: number, oct = 4): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * noise(x * freq + i * 17.3, y * freq - i * 9.1);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}
