import type { Look } from './looks';
import { makeRng } from './rng';
import type { Wind } from './wind';
import { clamp, clamp01, lerp, TAU } from './utils';

export interface Pad {
  nx: number; ny: number;      // 归一化锚点（漂移在此附近）
  r: number;                   // 半径（CSS px 基准 = 1）
  rot: number;
  variant: number;
  age: number;                 // 生长 0..1（1 = 长成）
  health: number;              // 0..1（1 = 翠绿）
  seed: number;
  ox: number; oy: number;      // 离锚点的偏移（风推 + 水花冲击）
  vx: number; vy: number;      // 偏移速度
}

export interface Lotus {
  nx: number; ny: number;
  variant: number;
  age: number;                 // 0 苞 → 1 盛 → >1 凋
  phase: 'bud' | 'bloom' | 'seedpod';
  seed: number;
  swayA: number;               // 茎的弯曲角（弹簧状态）
  swayV: number;               // 角速度
}

/** 漂移与摆动只依赖时间与风；生长依赖真实时间 */
export class Plants {
  pads: Pad[] = [];
  lotus: Lotus[] = [];
  time = 0;
  windK = 0.32;
  private lw = 1600;
  private lh = 900;

  constructor(seed = 7) {
    this.seedLayout(seed);
  }

  seedLayout(seed: number): void {
    const rng = makeRng(seed);
    // 荷叶聚在角落与边缘，中央留出开阔水域
    const clusters: [number, number][] = [
      [0.08, 0.1], [0.16, 0.22], [0.06, 0.4], [0.9, 0.12], [0.94, 0.3], [0.85, 0.06], [0.12, 0.88], [0.92, 0.86],
    ];
    for (const [cx, cy] of clusters) {
      const count = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i++) {
        this.pads.push({
          nx: Math.min(0.96, Math.max(0.04, cx + (rng() - 0.5) * 0.09)),
          ny: Math.min(0.94, Math.max(0.06, cy + (rng() - 0.5) * 0.09)),
          r: 26 + rng() * 34,
          rot: rng() * TAU,
          variant: Math.floor(rng() * 4),
          age: 0.55 + rng() * 0.45,
          health: 0.75 + rng() * 0.25,
          seed: Math.floor(rng() * 1e5),
          ox: 0, oy: 0, vx: 0, vy: 0,
        });
      }
    }
    for (let i = 0; i < 3; i++) {
      const p = clusters[Math.floor(rng() * clusters.length)];
      this.lotus.push({
        nx: Math.min(0.94, Math.max(0.06, p[0] + (rng() - 0.5) * 0.08)),
        ny: Math.min(0.92, Math.max(0.08, p[1] + (rng() - 0.5) * 0.08)),
        variant: Math.floor(rng() * 3),
        age: 0.5 + rng() * 0.6,
        phase: 'bloom',
        seed: Math.floor(rng() * 1e5),
        swayA: 0,
        swayV: 0,
      });
    }
  }

  /** 月份 → 季节系数 0(冬)..1(盛夏) */
  seasonK(now: Date): number {
    const m = now.getMonth() + 1;
    return clamp01(0.5 + 0.5 * Math.cos(((m - 7) / 12) * TAU * 2) * -1);
  }

  update(dt: number, look: Look, now: Date, wind: Wind): void {
    this.time += dt;
    this.windK = wind.k;
    const season = this.seasonK(now);
    const wx = Math.cos(wind.angle), wy = Math.sin(wind.angle);
    for (const p of this.pads) {
      p.age = clamp01(p.age + dt * 0.0000055); // 真实时间缓慢生长
      // 季节健康度漂移：夏绿秋黄
      const target = lerp(0.35, 0.95, season) + (makeRng(p.seed)() - 0.5) * 0.1;
      p.health += (clamp01(target) - p.health) * Math.min(1, dt * 0.004);
      // 风推 + 弹簧回锚 + 阻尼（荷叶被风吹离锚点，又被"根系"拉回）
      const push = 9 * wind.k;
      p.vx += (wx * push - p.ox * 0.6 - p.vx * 1.4) * dt;
      p.vy += (wy * push - p.oy * 0.6 - p.vy * 1.4) * dt;
      p.ox += p.vx * dt * 60 * 0.016;
      p.oy += p.vy * dt * 60 * 0.016;
      p.rot += wx * 0.01 * wind.k * dt;
    }
    for (const l of this.lotus) {
      l.age += dt * 0.0000045;
      if (l.phase === 'bloom' && l.age > 2.2) l.phase = 'seedpod';
      // 茎的弹簧动力学：风推（含阵风）+ 回正弹簧 + 阻尼——花头"像杆子撑着"地摇
      const drive = wx * wind.k * 2.2 + Math.sin(this.time * 1.3 + l.seed) * wind.k * 0.5;
      l.swayV += (-l.swayA * 3.2 + drive) * dt;
      l.swayV *= Math.exp(-dt * 1.4);
      l.swayA = clamp(l.swayA + l.swayV * dt, -0.55, 0.55);
    }
    void look;
  }

  /** 水花冲击：范围内的荷叶被推开、荷花茎被打颤（鱼跃/投食落点旁） */
  splashImpulse(x: number, y: number, radius: number, power: number): void {
    for (const p of this.pads) {
      const dx = p.nx * this.lw - x, dy = p.ny * this.lh - y;
      const d = Math.hypot(dx, dy);
      if (d < radius + p.r) {
        const k = (1 - d / (radius + p.r)) * power * 46;
        p.vx += (dx / (d || 1)) * k;
        p.vy += (dy / (d || 1)) * k;
      }
    }
    for (const l of this.lotus) {
      const dx = l.nx * this.lw - x, dy = l.ny * this.lh - y;
      const d = Math.hypot(dx, dy);
      if (d < radius + 90) {
        // 冲击方向决定茎弯向，强度随距离衰减
        l.swayV += ((dx / (d || 1)) * power * 2.6) * (1 - d / (radius + 90));
      }
    }
  }

  /** 荷花的开放度：晨开午合（真实荷花节律） */
  lotusOpenness(l: Lotus, look: Look): number {
    const h = look.sun.dayHour;
    // 5:30-8:00 渐开，8:00-13:00 盛开，13:00-17:30 渐合，夜闭合
    let open = 0;
    open = Math.max(open, Math.min(1, (h - 5.5) / 2.5));
    open = Math.min(open, Math.max(0, 1 - (h - 13) / 4.5), 1);
    if (h < 5.5 || h > 22) open = Math.max(0, Math.min(open, (h > 22 ? 0 : open)));
    if (h > 17.5) open = 0;
    // 幼株是花苞
    if (l.phase === 'bud') return Math.min(open, l.age);
    if (l.phase === 'seedpod') return 0;
    return clamp01(open) * clamp01((l.age - 0.4) * 2);
  }

  screenPos(p: { nx: number; ny: number; seed: number; ox?: number; oy?: number }, w: number, h: number): [number, number] {
    this.lw = w;
    this.lh = h;
    // 锚点附近的漂移：基础双频摆 + 风强放大
    const sway = 1 + this.windK * 1.6;
    const sx = (Math.sin(this.time * 0.11 + p.nx * 40) * 5 + Math.sin(this.time * 0.31 + p.ny * 70) * 2.5) * sway + (p.ox ?? 0);
    const sy = (Math.cos(this.time * 0.13 + p.ny * 50) * 5 + Math.cos(this.time * 0.27 + p.nx * 60) * 2.5) * sway + (p.oy ?? 0);
    return [p.nx * w + sx, p.ny * h + sy];
  }
}
