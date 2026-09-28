import type { Pond } from './pond';
import { makeRng } from './rng';
import type { Wind } from './wind';
import { TAU } from './utils';

export interface Strider { x: number; y: number; tx: number; ty: number; hopT: number; rippleT: number; seed: number }
export interface Snail { nx: number; ny: number; angle: number; turnT: number; variant: number; bubbleT: number }
export interface Shrimp { nx: number; ny: number; angle: number; state: 'idle' | 'dart'; t: number; dartVX: number; dartVY: number }
export interface Bubble { x: number; y: number; r: number; vy: number; wob: number; age: number }
export interface Weed { nx: number; ny: number; s: number; seed: number }

/**
 * 底栖与水面小生物的统一容器。坐标：水黾/浮萍用 CSS px（水面层），
 * 螺/虾用归一化（池底层）。
 */
export class Critters {
  striders: Strider[] = [];
  snails: Snail[] = [];
  shrimps: Shrimp[] = [];
  bubbles: Bubble[] = [];
  weeds: Weed[] = [];
  time = 0;

  constructor() {
    const rng = makeRng(42);
    for (let i = 0; i < 3; i++) {
      const x = 200 + rng() * 900, y = 150 + rng() * 400;
      this.striders.push({ x, y, tx: x, ty: y, hopT: 0, rippleT: 0, seed: rng() * 100 });
    }
    for (let i = 0; i < 3; i++) {
      this.snails.push({ nx: 0.2 + rng() * 0.6, ny: 0.25 + rng() * 0.5, angle: rng() * TAU, turnT: rng() * 6, variant: Math.floor(rng() * 3), bubbleT: 4 + rng() * 10 });
    }
    for (let i = 0; i < 3; i++) {
      this.shrimps.push({ nx: 0.25 + rng() * 0.5, ny: 0.3 + rng() * 0.4, angle: rng() * TAU, state: 'idle', t: 2 + rng() * 5, dartVX: 0, dartVY: 0 });
    }
    for (let i = 0; i < 46; i++) {
      // 浮萍聚在几个静水团
      const cx = [0.07, 0.94, 0.5][i % 3], cy = [0.55, 0.6, 0.06][i % 3];
      this.weeds.push({ nx: cx + (rng() - 0.5) * 0.08, ny: cy + (rng() - 0.5) * 0.1, s: 0.7 + rng() * 0.8, seed: rng() * 100 });
    }
  }

  update(dt: number, pond: Pond, pointer: { x: number; y: number } | null, onRipple: (x: number, y: number, s: number) => void, wind?: Wind): void {
    this.time += dt;
    const w = pond.width, h = pond.height;

    // ---- 水黾：巡逻滑行，周期性压出微涟漪，受惊连跳 ----
    for (const s of this.striders) {
      s.rippleT -= dt;
      const d = Math.hypot(s.tx - s.x, s.ty - s.y);
      if (d < 6) {
        s.tx = 60 + Math.random() * (w - 120);
        s.ty = 50 + Math.random() * (h - 100);
      } else {
        const v = 46;
        s.x += ((s.tx - s.x) / d) * v * dt;
        s.y += ((s.ty - s.y) / d) * v * dt;
      }
      if (s.rippleT <= 0) {
        s.rippleT = 0.55;
        onRipple(s.x, s.y, 0.12);
      }
      if (pointer) {
        const pd = Math.hypot(s.x - pointer.x, s.y - pointer.y);
        if (pd < 70 && s.hopT <= 0) {
          const a = Math.atan2(s.y - pointer.y, s.x - pointer.x) + (Math.random() - 0.5) * 0.6;
          s.x += Math.cos(a) * 46;
          s.y += Math.sin(a) * 46;
          s.tx = s.x; s.ty = s.y;
          s.hopT = 0.5;
          onRipple(s.x, s.y, 0.5);
        }
      }
      s.hopT = Math.max(0, s.hopT - dt);
    }

    // ---- 螺蛳：极慢爬行，偶尔回头，吐泡泡 ----
    for (const s of this.snails) {
      s.turnT -= dt;
      if (s.turnT <= 0) { s.turnT = 3 + Math.random() * 6; s.angle += (Math.random() - 0.5) * 1.6; }
      s.nx += (Math.cos(s.angle) * 0.0022 * dt) / 1; // ~2-3 px/s @1600
      s.ny += (Math.sin(s.angle) * 0.0022 * dt) / 1;
      if (s.nx < 0.05 || s.nx > 0.95 || s.ny < 0.06 || s.ny > 0.94) {
        s.angle += Math.PI * (0.75 + Math.random() * 0.5);
        s.nx = Math.min(0.95, Math.max(0.05, s.nx));
        s.ny = Math.min(0.94, Math.max(0.06, s.ny));
      }
      s.bubbleT -= dt;
      if (s.bubbleT <= 0) {
        s.bubbleT = 6 + Math.random() * 14;
        this.bubbles.push({ x: s.nx * w, y: s.ny * h, r: 1 + Math.random(), vy: 14, wob: Math.random() * 10, age: 0 });
      }
    }

    // ---- 青虾：蓄力-弹退-滑行 ----
    for (const s of this.shrimps) {
      s.t -= dt;
      if (s.state === 'idle') {
        if (s.t <= 0) {
          s.state = 'dart';
          s.t = 0.35;
          const back = s.angle + Math.PI + (Math.random() - 0.5) * 0.8;
          const power = 120 + Math.random() * 90;
          s.dartVX = Math.cos(back) * power;
          s.dartVY = Math.sin(back) * power;
          if (pointer && Math.hypot(s.nx * w - pointer.x, s.ny * h - pointer.y) < 90) {
            const a = Math.atan2(s.ny * h - pointer.y, s.nx * w - pointer.x);
            s.dartVX = Math.cos(a) * 190;
            s.dartVY = Math.sin(a) * 190;
          }
        } else {
          s.angle += Math.sin(this.time * 0.7 + s.nx * 30) * 0.04 * dt * 60;
        }
      } else {
        s.nx += (s.dartVX * dt) / w;
        s.ny += (s.dartVY * dt) / h;
        s.dartVX *= 1 - dt * 4;
        s.dartVY *= 1 - dt * 4;
        s.angle = Math.atan2(-s.dartVY, -s.dartVX); // 头朝弹射反方向
        if (s.t <= 0) { s.state = 'idle'; s.t = 3 + Math.random() * 6; }
        s.nx = Math.min(0.95, Math.max(0.05, s.nx));
        s.ny = Math.min(0.94, Math.max(0.06, s.ny));
      }
    }

    // ---- 泡泡：上浮，到水面破裂 ----
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.age += dt;
      b.y -= b.vy * dt;
      b.vy *= 1 + dt * 0.35;
      b.x += Math.sin(b.age * 5 + b.wob) * 6 * dt;
      if (b.y < 12) {
        onRipple(b.x, b.y, 0.08);
        this.bubbles.splice(i, 1);
      }
    }
    if (this.bubbles.length > 40) this.bubbles.splice(0, this.bubbles.length - 40);

    // ---- 深水锦鲤呼出泡泡 ----
    for (const f of pond.fish) {
      if (f.depth > 0.55 && Math.random() < dt * 0.06) {
        this.bubbles.push({ x: f.x * w, y: f.y * h, r: 1 + Math.random() * 1.6, vy: 12, wob: Math.random() * 10, age: 0 });
      }
    }

    // ---- 浮萍：风推着漂；被锦鲤啄食则缩小 ----
    const wwx = wind ? Math.cos(wind.angle) * wind.k : 0;
    const wwy = wind ? Math.sin(wind.angle) * wind.k : 0;
    for (const wd of this.weeds) {
      wd.nx += (Math.sin(this.time * 0.05 + wd.seed) * 0.0009 + wwx * 0.0045) * dt;
      wd.ny += (Math.cos(this.time * 0.04 + wd.seed * 1.3) * 0.0009 + wwy * 0.0045) * dt;
      for (const f of pond.fish) {
        const d = Math.hypot(wd.nx * w - f.x * w, wd.ny * h - f.y * h);
        if (d < 40 * f.size) wd.s = Math.max(0.25, wd.s - dt * 0.06);
      }
      wd.s = Math.min(1.6, wd.s + dt * 0.001);
      wd.nx = Math.min(0.98, Math.max(0.02, wd.nx));
      wd.ny = Math.min(0.98, Math.max(0.02, wd.ny));
    }
  }
}
