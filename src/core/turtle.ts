import type { Pond } from './pond';
import { makeRng } from './rng';
import { TAU, clamp } from './utils';

export interface TurtleT {
  nx: number; ny: number;
  angle: number;
  v: number;
  turn: number;
  depth: number; depthGoal: number;
  breathT: number;          // 距下次浮头换气
  surfacing: number;        // >0 = 正在水面换气
  variant: number;
  seed: number;
}

/**
 * 荷塘乌龟：慢速巡游，定时浮头换气（到水面触发涟漪+一串泡泡，停几秒再下潜）。
 * 复用归一化坐标与深度系统，绘制在场景层（水下）。
 */
export class TurtleSystem {
  turtles: TurtleT[] = [];
  time = 0;

  constructor(count = 2) {
    const rng = makeRng(2024);
    for (let i = 0; i < count; i++) {
      this.turtles.push({
        nx: 0.3 + rng() * 0.4,
        ny: 0.3 + rng() * 0.4,
        angle: rng() * TAU,
        v: 14,
        turn: 0,
        depth: 0.45 + rng() * 0.3,
        depthGoal: 0.5,
        breathT: 18 + rng() * 22,
        surfacing: 0,
        variant: i % 2,
        seed: Math.floor(rng() * 1e5),
      });
    }
  }

  update(dt: number, pond: Pond, onRipple: (x: number, y: number, s: number) => void, onBubble: (x: number, y: number) => void): void {
    this.time += dt;
    const w = pond.width, h = pond.height;
    for (const t of this.turtles) {
      if (t.surfacing > 0) {
        // 水面换气：抬头（深度归零）、缓慢打转，结束下潜
        t.surfacing -= dt;
        t.depthGoal = 0.02;
        t.depth += (t.depthGoal - t.depth) * Math.min(1, dt * 1.5);
        t.angle += Math.sin(this.time * 0.7 + t.seed) * 0.25 * dt;
        t.nx += (Math.cos(t.angle) * t.v * 0.4 * dt) / w;
        t.ny += (Math.sin(t.angle) * t.v * 0.4 * dt) / h;
        if (Math.random() < dt * 1.5) onBubble(t.nx * w, t.ny * h);
        if (t.surfacing <= 0) {
          t.depthGoal = 0.45 + Math.random() * 0.3;
          t.breathT = 24 + Math.random() * 20;
          onRipple(t.nx * w, t.ny * h, 0.25);
        }
      } else {
        // 巡游：缓慢蜿蜒 + 偶发停留
        t.turn += (Math.sin(this.time * 0.23 + t.seed * 1.7) * 0.5 - t.turn) * Math.min(1, dt * 0.8);
        t.angle += t.turn * dt;
        const cruise = t.v * pond.scale;
        t.nx += (Math.cos(t.angle) * cruise * dt) / w;
        t.ny += (Math.sin(t.angle) * cruise * dt) / h;
        // 边界回转
        if (t.nx < 0.08 || t.nx > 0.92 || t.ny < 0.08 || t.ny > 0.92) {
          const target = Math.atan2(0.5 - t.ny, 0.5 - t.nx) + (Math.random() - 0.5) * 0.8;
          t.angle += clamp(target - t.angle, -Math.PI, Math.PI) * Math.min(1, dt * 2);
          t.nx = clamp(t.nx, 0.06, 0.94);
          t.ny = clamp(t.ny, 0.06, 0.94);
        }
        t.depth += (t.depthGoal - t.depth) * Math.min(1, dt * 0.4);
        t.breathT -= dt;
        if (t.breathT <= 0) {
          t.surfacing = 3.5 + Math.random() * 2;
          onRipple(t.nx * w, t.ny * h, 0.2);
        }
      }
      t.nx = clamp(t.nx, 0.05, 0.95);
      t.ny = clamp(t.ny, 0.05, 0.95);
    }
  }
}
