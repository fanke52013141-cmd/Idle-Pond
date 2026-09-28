export const TAU = Math.PI * 2;

export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 角度归一化到 [-π, π] */
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** 平滑阶梯；a > b 时自动反向 */
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function hexRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
