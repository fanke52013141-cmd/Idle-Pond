import { girthOf, KOI_BODY } from './body';
import { hash1, makeRng } from './rng';
import { updateSpine } from './spine';
import type { Fish, FishData, FoodPellet, PondEvent } from './types';
import { TAU, clamp, wrapAngle } from './utils';

const NAMES = ['青瓷', '月白', '沉璧', '荷风', '听雨', '藕花', '掬月', '渡月', '涟漪', '素波', '映荷', '枕水', '拾星', '浮玉', '疏影', '半亩'];

export function makeFish(index: number, rng: () => number = Math.random): FishData {
  return {
    id: `koi-${Date.now().toString(36)}-${index}`,
    name: NAMES[index % NAMES.length],
    palette: index % 7,
    seed: Math.floor(rng() * 1e5),
    size: 0.52 + rng() * 0.34,
    x: 0.18 + rng() * 0.64,
    y: 0.2 + rng() * 0.6,
    angle: rng() * TAU,
    speedMul: 0.85 + rng() * 0.3,
    meals: 0,
    bornAt: Date.now(),
  };
}

/** 初始化运行时状态（幂等） */
export function wake(f: Fish): void {
  if (f.v !== undefined) return;
  f.v = 0;
  f.turn = 0;
  f.thrust = 0;
  f.beating = false;
  f.amp = 0.25;
  f.phase = hash1(f.seed) * 10;
  f.depth = 0.25 + hash1(f.seed + 1) * 0.55;
  f.depthGoal = f.depth;
  f.goal = null;
  f.goalTime = 0;
  f.rest = 0;
  f.flee = 0;
  f.fleeAngle = 0;
  f.cruise = (0.3 + hash1(f.seed + 2) * 0.22) * clamp(f.speedMul, 0.5, 1.5);
  f.react = 0.15 + hash1(f.seed + 3) * 0.9;
  f.appetite = 0.55 + hash1(f.seed + 4) * 0.45;
  f.spine = null;
  f.spineScale = 0;
  f.jump = null;
}

/**
 * 池塘模拟：鱼的行为（觅食/游荡/惊逃/避让）+ 鱼食物理 + 事件流。
 * 坐标：鱼以归一化 (0..1) 存储，行为计算换算到像素。
 */
export class Pond {
  fish: Fish[] = [];
  food: FoodPellet[] = [];
  events: PondEvent[] = [];
  width = 1280;
  height = 720;
  scale = 1;
  time = 0;
  private rng: () => number;

  constructor(seed = 20260927) {
    this.rng = makeRng(seed);
  }

  add(data: FishData): Fish {
    const f = { ...data } as Fish;
    wake(f);
    this.fish.push(f);
    return f;
  }

  layout(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.scale = clamp(Math.min(w, h) / 820, 0.8, 2.2);
  }

  feed(x: number, y: number, count = 8): boolean {
    if (this.food.length >= 180) return false;
    for (let i = 0; i < count && this.food.length < 180; i++) {
      const a = this.rng() * TAU;
      const r = Math.sqrt(this.rng()) * 24;
      this.food.push({
        x: clamp(x + Math.cos(a) * r, 15, this.width - 15),
        y: clamp(y + Math.sin(a) * r, 15, this.height - 15),
        life: 25,
        age: 0,
        drift: this.rng() * 6,
        vx: Math.cos(a) * r * 0.8,
        vy: Math.sin(a) * r * 0.8,
        eaten: false,
      });
    }
    return true;
  }

  /** 无食的轻点：附近的鱼受惊疾游 */
  scare(x: number, y: number, radius = 180): void {
    for (const f of this.fish) {
      const dx = f.x * this.width - x, dy = f.y * this.height - y;
      const d = Math.hypot(dx, dy);
      if (d < radius) {
        f.flee = 0.45 + (1 - d / radius) * 0.7;
        f.fleeAngle = Math.atan2(dy, dx) + (this.rng() - 0.5) * 0.9;
        f.beating = true;
        f.v = Math.max(f.v, KOI_BODY.length * f.size * this.scale * 0.8);
        f.depthGoal = Math.min(0.95, f.depth + 0.35);
      }
    }
  }

  step(dt: number): void {
    dt = clamp(dt, 0, 0.05);
    this.time += dt;
    const w = this.width, h = this.height;
    for (const p of this.food) {
      p.life -= dt;
      p.age += dt;
      const k = Math.exp(-dt * 1.8);
      p.vx *= k;
      p.vy *= k;
      p.x = clamp(p.x + (p.vx + Math.sin(this.time * 0.35 + p.drift) * 1.2) * dt, 8, w - 8);
      p.y = clamp(p.y + (p.vy + Math.cos(this.time * 0.29 + p.drift * 1.3) * 1.2) * dt, 8, h - 8);
    }
    this.food = this.food.filter((p) => p.life > 0 && !p.eaten);
    for (const f of this.fish) if (!f.jump) this.swim(f, dt); // 跃出水面的鱼由 JumpSystem 接管
    if (this.food.some((p) => p.eaten)) this.food = this.food.filter((p) => !p.eaten);
  }

  private pickGoal(f: Fish): void {
    const r = this.rng, w = this.width, h = this.height;
    const m = 0.15, span = Math.min(w, h);
    let best: { x: number; y: number } | null = null, score = -Infinity;
    for (let i = 0; i < 8; i++) {
      const gx = m + r() * (1 - 2 * m), gy = m + r() * (1 - 2 * m);
      const dx = (gx - f.x) * w, dy = (gy - f.y) * h, d = Math.hypot(dx, dy);
      // 偏好与当前航向夹角小、距离适中的目标，制造从容的巡游感
      const sc = -Math.abs(wrapAngle(Math.atan2(dy, dx) - f.angle)) * 1.2 + (Math.min(d, span * 0.6) / span) * 2 + r() * 0.6;
      if (sc > score) {
        score = sc;
        best = { x: gx, y: gy };
      }
    }
    f.goal = best ?? { x: 0.5, y: 0.5 };
    f.goalTime = 7 + r() * 12;
  }

  private swim(f: Fish, dt: number): void {
    const w = this.width, h = this.height;
    const s = f.size * this.scale, L = KOI_BODY.length * s;
    const x = f.x * w, y = f.y * h;
    const cos = Math.cos(f.angle), sin = Math.sin(f.angle);
    const mx = x + cos * KOI_BODY.nose * s, my = y + sin * KOI_BODY.nose * s;

    let gx = cos, gy = sin, want = f.cruise * L;
    let turnGain = 2, maxTurn = 1.3, sepW = 2.2, boundW = 3;
    let seeking = false;

    f.flee = Math.max(0, f.flee - dt);
    if (f.flee > 0) {
      // 惊逃：快 C 形转身 + 冲刺
      gx = Math.cos(f.fleeAngle);
      gy = Math.sin(f.fleeAngle);
      want = 2.6 * L;
      turnGain = 9;
      maxTurn = 7;
      f.depthGoal = Math.min(0.95, f.depth + 0.2);
    } else {
      let food: FoodPellet | null = null, fd = Infinity;
      for (const p of this.food) {
        if (p.eaten) continue;
        const d = Math.hypot(p.x - mx, p.y - my);
        if (d < fd && d < Math.max(w, h) * f.appetite && p.age > f.react + d / 650) {
          fd = d;
          food = p;
        }
      }
      if (food) {
        seeking = true;
        const dx = food.x - x, dy = food.y - y, d = Math.hypot(dx, dy) || 1;
        const err = Math.abs(wrapAngle(Math.atan2(dy, dx) - f.angle));
        gx = dx / d;
        gy = dy / d;
        want = clamp(fd / L * 1.3, 0.25, 2.2) * L * Math.max(0.12, Math.cos(Math.min(err, Math.PI / 2)) ** 2);
        turnGain = 4.5;
        maxTurn = 3.4;
        sepW = 1.1;
        boundW = 0.8;
        f.depthGoal = 0.04;
        if (fd < Math.max(6, 7 * s)) {
          food.eaten = true;
          f.meals++;
          this.events.push({ type: 'eat', x: food.x, y: food.y, fish: f });
        }
        // 正下方吃不到的食物：先游开拉开距离再回身
        if (d < KOI_BODY.nose * s * 1.15 && err > 0.6) {
          gx = cos;
          gy = sin;
          want = 0.7 * L;
        }
      } else {
        // 游荡：随机目标 + 航向正弦扰动 + 偶发小憩
        f.goalTime -= dt;
        if (!f.goal || f.goalTime <= 0 || Math.hypot(f.goal.x * w - x, f.goal.y * h - y) < L * 1.3) this.pickGoal(f);
        const goal = f.goal!;
        const a = Math.atan2(goal.y * h - y, goal.x * w - x) + Math.sin(this.time * 0.21 + f.seed) * 0.45 + Math.sin(this.time * 0.53 + f.seed * 1.7) * 0.2;
        gx = Math.cos(a);
        gy = Math.sin(a);
        f.rest = Math.max(0, f.rest - dt);
        if (f.rest <= 0 && this.rng() < dt * 0.02) f.rest = 2 + this.rng() * 4;
        want = f.cruise * L * (f.rest > 0 ? 0.12 : 1);
        if (this.rng() < dt * 0.015) f.depthGoal = 0.15 + this.rng() * 0.75;
      }
    }

    // 邻居：保持私人空间；无食时与同花色对齐航向
    let sx = 0, sy = 0, ax = 0, ay = 0;
    for (const o of this.fish) {
      if (o === f) continue;
      const ox = o.x * w - x, oy = o.y * h - y;
      const d = Math.hypot(ox, oy);
      if (d < 1e-6) continue;
      const R = (L + KOI_BODY.length * o.size * this.scale) * 0.52;
      const near = 1 - Math.min(1, Math.abs(o.depth - f.depth) * 1.6);
      if (d < R) {
        const k = (1 - d / R) ** 2 * near;
        sx -= (ox / d) * k;
        sy -= (oy / d) * k;
      }
      if (!seeking && d < L * 2.5 && o.palette === f.palette) {
        ax += Math.cos(o.angle);
        ay += Math.sin(o.angle);
      }
    }
    const al = Math.hypot(ax, ay);
    if (al > 0) {
      ax /= al;
      ay /= al;
    }

    // 边界：前瞻回头
    const mX = Math.min(w * 0.1 + L * 0.3, w * 0.3), mY = Math.min(h * 0.1 + L * 0.3, h * 0.3);
    const lx = x + cos * L * 1.2, ly = y + sin * L * 1.2;
    let bx = 0, by = 0;
    if (lx < mX) bx = (mX - lx) / mX;
    else if (lx > w - mX) bx = (w - mX - lx) / mX;
    if (ly < mY) by = (mY - ly) / mY;
    else if (ly > h - mY) by = (h - mY - ly) / mY;

    const desired = Math.atan2(gy + sy * sepW + ay * 0.15 + by * boundW, gx + sx * sepW + ax * 0.15 + bx * boundW);
    f.turn += (clamp(wrapAngle(desired - f.angle) * turnGain, -maxTurn, maxTurn) - f.turn) * Math.min(1, dt * 4);
    f.angle = wrapAngle(f.angle + f.turn * dt);

    // 打水-滑行：几下尾鳍加速，随后收滑
    if (f.v < want * 0.8) f.beating = true;
    else if (f.v > want * 1.15) f.beating = false;
    f.thrust += ((f.beating ? 1 : 0) - f.thrust) * Math.min(1, dt * 6);
    if (f.beating) f.v += (want * 1.25 - f.v) * (1 - Math.exp(-dt * 2.4 * f.thrust));
    else f.v *= Math.exp(-dt * (f.v > want * 1.6 ? 1.6 : 0.5));
    f.v *= Math.exp(-dt * Math.abs(f.turn) * 0.25);
    const bl = f.v / L;
    f.phase = (f.phase + dt * TAU * (0.45 + f.thrust * (1.1 + 1.3 * Math.min(2.5, bl)) + Math.abs(f.turn) * 0.35)) % (TAU * 1000);
    f.amp += ((0.14 + 0.86 * f.thrust * Math.min(1, 0.5 + bl * 0.6) + Math.min(0.4, Math.abs(f.turn) * 0.25)) - f.amp) * Math.min(1, dt * 3);

    f.x = clamp((x + Math.cos(f.angle) * f.v * dt) / w, 0.03, 0.97);
    f.y = clamp((y + Math.sin(f.angle) * f.v * dt) / h, 0.035, 0.965);
    f.depth += (f.depthGoal - f.depth) * Math.min(1, dt * (seeking ? 1.2 : 0.35));
    updateSpine(f, s, w, h);
  }

  girthOfFish(f: Fish): number {
    return girthOf(f.seed);
  }
}
