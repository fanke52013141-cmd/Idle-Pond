import { KOI_BODY, SEG_UNITS } from './body';
import type { Fish } from './types';
import { clamp, wrapAngle } from './utils';

/**
 * 脊柱链：头引领，身体跟着头走过的路径走。
 * 前 rigidHead 节随航向刚性直排，其后每节在上一节方向的基础上限位偏转。
 */
export function updateSpine(f: Fish, scale: number, w: number, h: number): void {
  const n = KOI_BODY.segments, rigid = KOI_BODY.rigidHead;
  const seg = SEG_UNITS * scale;
  const x = f.x * w, y = f.y * h;
  const c = Math.cos(f.angle), s = Math.sin(f.angle);
  const nx = x + c * KOI_BODY.nose * scale, ny = y + s * KOI_BODY.nose * scale;

  let p = f.spine;
  if (!p || Math.abs(f.spineScale - scale) > scale * 0.3 || Math.hypot(p[0] - nx, p[1] - ny) > seg * 3) {
    p = f.spine = new Float32Array((n + 1) * 2);
    for (let i = 0; i <= n; i++) {
      p[i * 2] = nx - c * seg * i;
      p[i * 2 + 1] = ny - s * seg * i;
    }
  }
  f.spineScale = scale;

  for (let i = 0; i <= rigid; i++) {
    p[i * 2] = nx - c * seg * i;
    p[i * 2 + 1] = ny - s * seg * i;
  }
  let prev = f.angle;
  for (let i = rigid + 1; i <= n; i++) {
    const px = p[(i - 1) * 2], py = p[(i - 1) * 2 + 1];
    const lim = 0.1 + (0.16 * i) / n;
    const a = prev + clamp(wrapAngle(Math.atan2(py - p[i * 2 + 1], px - p[i * 2]) - prev), -lim, lim);
    p[i * 2] = px - Math.cos(a) * seg;
    p[i * 2 + 1] = py - Math.sin(a) * seg;
    prev = a;
  }
}

/**
 * 在脊柱上叠加从头传向尾的行波，输出每点 (x, y, 法线x, 法线y)。
 * 包络让头部几乎不摆、尾部全幅摆动；渲染端按此数据切条变形。
 */
export function poseSpine(f: Fish, scale: number, out?: Float32Array): Float32Array {
  const n = KOI_BODY.segments;
  out = out ?? new Float32Array((n + 1) * 4);
  const p = f.spine!;
  const amp = f.amp * 6.4 * scale;
  for (let i = 0; i <= n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n, i + 1);
    let tx = p[a * 2] - p[b * 2], ty = p[a * 2 + 1] - p[b * 2 + 1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const u = i / n;
    const env = 0.05 + 0.95 * Math.pow(Math.max(0, (u - 0.2) / 0.8), 1.5);
    const lat = amp * env * Math.sin(f.phase - u * 5.4);
    out[i * 4] = p[i * 2] - ty * lat;
    out[i * 4 + 1] = p[i * 2 + 1] + tx * lat;
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n, i + 1);
    let tx = out[a * 4] - out[b * 4], ty = out[a * 4 + 1] - out[b * 4 + 1];
    const l = Math.hypot(tx, ty) || 1;
    out[i * 4 + 2] = -ty / l;
    out[i * 4 + 3] = tx / l;
  }
  return out;
}
