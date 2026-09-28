import type { Pond } from './pond';
import type { FoodPellet } from './types';
import { TAU, clamp } from './utils';

interface Minnow {
  x: number; y: number; vx: number; vy: number;
  ang: number;              // 平滑后的朝向（S5：消除转向折角）
  variant: number;
  seed: number; panic: number;
}

/** 银鱼群：轻量 boids（聚合/对齐/分离）+ 惊吓炸群 + 抢食碎屑 */
export class MinnowSchool {
  fish: Minnow[] = [];
  private time = 0;

  constructor(count = 18) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      this.fish.push({
        x: 0.5 + Math.cos(a) * 0.03 * Math.random(),
        y: 0.42 + Math.sin(a) * 0.03 * Math.random(),
        vx: Math.cos(a) * 30,
        vy: Math.sin(a) * 30,
        ang: a,
        variant: i % 2,
        seed: Math.random() * 100,
        panic: 0,
      });
    }
  }

  update(dt: number, pond: Pond, pointers: { x: number; y: number }[]): void {
    this.time += dt;
    const w = pond.width, h = pond.height;
    const list = this.fish;

    // 群心与平均航向
    let cx = 0, cy = 0, ax = 0, ay = 0;
    for (const f of list) { cx += f.x; cy += f.y; ax += f.vx; ay += f.vy; }
    cx /= list.length; cy /= list.length;
    const al = Math.hypot(ax, ay) || 1;
    ax /= al; ay /= al;

    for (const f of list) {
      let fx = 0, fy = 0;
      // 聚合 + 对齐
      fx += (cx - f.x) * 2.4; fy += (cy - f.y) * 2.4;
      fx += (ax - f.vx / 60) * 26; fy += (ay - f.vy / 60) * 26;
      // 分离
      for (const o of list) {
        if (o === f) continue;
        const dx = f.x - o.x, dy = f.y - o.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 0.0004 && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          fx += (dx / d) * 0.9 * (1 - d / 0.02);
          fy += (dy / d) * 0.9 * (1 - d / 0.02);
        }
      }

      const px = f.x * w, py = f.y * h;

      // 锦鲤惊吓：大鱼靠近且在加速 → 炸群
      for (const k of pond.fish) {
        const kx = k.x * w, ky = k.y * h;
        const d = Math.hypot(px - kx, py - ky);
        const L = 92 * k.size * pond.scale;
        if (d < L * 1.4 && k.v > L * 1.1) {
          const imp = 220 * (1 - d / (L * 1.4));
          fx += ((px - kx) / (d || 1)) * imp * 4;
          fy += ((py - ky) / (d || 1)) * imp * 4;
          f.panic = 2.2;
        } else if (d < L * 3.2) {
          fx += ((px - kx) / (d || 1)) * 22; // 平时保持距离
          fy += ((py - ky) / (d || 1)) * 22;
        }
      }

      // 指针轻微避让
      for (const pt of pointers) {
        const d = Math.hypot(px - pt.x, py - pt.y);
        if (d < 90) { fx += ((px - pt.x) / (d || 1)) * 60; fy += ((py - pt.y) / (d || 1)) * 60; }
      }

      // 抢食碎屑：老化的食物粒
      let best: FoodPellet | null = null, bd = 1e9;
      for (const p of pond.food) {
        if (p.eaten || p.age < 5) continue;
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < bd && d < 320) { bd = d; best = p; }
      }
      if (best) {
        const d = bd || 1;
        fx += ((best.x - px) / d) * 46;
        fy += ((best.y - py) / d) * 46;
        if (bd < 8) best.eaten = true; // 小鱼叼走，不计入锦鲤食量
      }

      // 边界回中
      const m = 0.06;
      if (f.x < m) fx += (m - f.x) * 320;
      if (f.x > 1 - m) fx -= (f.x - 1 + m) * 320;
      if (f.y < m) fy += (m - f.y) * 320;
      if (f.y > 1 - m) fy -= (f.y - 1 + m) * 320;

      // 积分
      const maxV = (f.panic > 0 ? 150 : 62) * pond.scale;
      f.vx = clamp(f.vx + fx * dt, -maxV, maxV);
      f.vy = clamp(f.vy + fy * dt, -maxV, maxV);
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > maxV) { f.vx *= maxV / sp; f.vy *= maxV / sp; }
      f.vx *= 1 - dt * 0.6; f.vy *= 1 - dt * 0.6;
      f.x = Math.min(0.985, Math.max(0.015, f.x + (f.vx * dt) / w));
      f.y = Math.min(0.985, Math.max(0.015, f.y + (f.vy * dt) / h));
      f.panic = Math.max(0, f.panic - dt);
      // 朝向插值：转向有过程，没有瞬移折角
      const target = Math.atan2(f.vy, f.vx);
      let d = target - f.ang;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      f.ang += d * Math.min(1, dt * 7);
    }
  }

  heading(f: Minnow): number {
    return f.ang;
  }
}
