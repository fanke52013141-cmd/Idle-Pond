import { KOI_BODY } from './body';
import type { Pond } from './pond';
import type { Fish } from './types';
import { clamp01 } from './utils';

export interface Jump {
  fish: Fish;
  t: number;
  dur: number;
  dirX: number;
  dirY: number;
  power: number;
  exited: boolean;
}

/**
 * 鱼跃编排：加速上浮 → 破水（出水花）→ 空中弧线（depth < 0）→ 入水（大水花）。
 * 空中段由覆盖层绘制；同时通过回调把溅落点交给涟漪/水珠系统。
 */
export class JumpSystem {
  active: Jump | null = null;
  cooldown = 8;

  update(dt: number, pond: Pond, hooks: { onSplash: (x: number, y: number, power: number) => void }): void {
    this.cooldown -= dt;
    const j = this.active;

    if (!j) {
      if (this.cooldown > 0) return;
      // 挑一尾浅水、有速度的鱼；清晨活跃期概率加权
      const hour = new Date().getHours();
      const morningK = hour >= 5 && hour <= 9 ? 0.014 : 0.004;
      if (Math.random() > morningK * dt * 60) return;
      const candidates = pond.fish.filter((f) => f.depth < 0.35 && f.v > KOI_BODY.length * f.size * pond.scale * 0.8);
      if (!candidates.length) return;
      const fish = candidates[Math.floor(Math.random() * candidates.length)];
      const dirX = Math.cos(fish.angle), dirY = Math.sin(fish.angle);
      this.active = { fish, t: 0, dur: 1.25 + Math.random() * 0.4, dirX, dirY, power: 0.8 + Math.random() * 0.5, exited: false };
      // 出水瞬间：上冲 + 水花
      fish.beating = true;
      fish.v = KOI_BODY.length * fish.size * pond.scale * 2.2;
      fish.depthGoal = 0;
      hooks.onSplash(fish.x * pond.width, fish.y * pond.height, 0.9);
      return;
    }

    // 空中段
    j.t += dt;
    const f = j.fish;
    const k = j.t / j.dur;
    // 抛物线：depth 从 0.05 俯冲到 -0.35 再回 0.1
    f.depth = 0.05 - Math.sin(k * Math.PI) * 0.4;
    const speed = KOI_BODY.length * f.size * pond.scale * 1.9;
    f.x = clamp01(f.x + (j.dirX * speed * dt) / pond.width);
    f.y = clamp01(f.y + (j.dirY * speed * dt) / pond.height);
    f.phase += dt * 9;

    if (!j.exited && k > 0.92) {
      // 入水：大水花 + 溅射
      j.exited = true;
      hooks.onSplash(f.x * pond.width, f.y * pond.height, 1.4);
      f.depthGoal = 0.35;
      f.flee = 0;
    }
    if (j.t >= j.dur) {
      this.active = null;
      this.cooldown = 14 + Math.random() * 18;
    }
  }
}
