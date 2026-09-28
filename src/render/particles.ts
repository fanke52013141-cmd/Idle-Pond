import type { Pad, Plants } from '../core/plants';

interface Droplet {
  x: number; y: number; vx: number; vy: number; z: number; vz: number;
  age: number; life: number; r: number;
  leaf: { pad: Pad; ang: number; dist: number } | null; // 落在叶面上
}
interface Crown { x: number; y: number; age: number; life: number; s: number }

/**
 * 水面粒子：水花冠 + 飞溅水珠；水珠落在荷叶上会滚动、合并、滚出叶缘再落水。
 * onLand：水珠落水 → 注入涟漪；onLeafHit：水珠砸中叶面 → 叶面水珠。
 */
export class Particles {
  private droplets: Droplet[] = [];
  private crowns: Crown[] = [];
  private leafDrops: { pad: Pad; ang: number; dist: number; r: number; v: number }[] = [];

  splash(x: number, y: number, power: number): void {
    this.crowns.push({ x, y, age: 0, life: 0.55 + power * 0.25, s: 10 + power * 16 });
    const n = 3 + Math.round(power * 5);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 90 * power;
      this.droplets.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        z: 2, vz: 90 + Math.random() * 80 * power,
        age: 0, life: 1.6, r: 1 + Math.random() * 1.4,
        leaf: null,
      });
    }
  }

  update(dt: number, plants: Plants, w: number, h: number, onLand: (x: number, y: number, power: number) => void): void {
    for (let i = this.crowns.length - 1; i >= 0; i--) {
      this.crowns[i].age += dt;
      if (this.crowns[i].age > this.crowns[i].life) this.crowns.splice(i, 1);
    }
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const d = this.droplets[i];
      d.age += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      d.vz -= 320 * dt;
      if (d.z <= 0) {
        // 落到水面高度：命中荷叶则转为叶面水珠，否则落水出涟漪
        let landed = false;
        for (const p of plants.pads) {
          const [px, py] = plants.screenPos(p, w, h);
          if (Math.hypot(d.x - px, d.y - py) < p.r * 0.92) {
            this.landOnLeaf(p, d.x, d.y, px, py);
            landed = true;
            break;
          }
        }
        if (!landed) onLand(d.x, d.y, 0.22 + d.r * 0.18);
        this.droplets.splice(i, 1);
        continue;
      }
      if (d.age > d.life) this.droplets.splice(i, 1);
    }
    // 叶面水珠：向外缘滚动，滚出叶缘即消失（下次鱼跃/雨再补）
    for (let i = this.leafDrops.length - 1; i >= 0; i--) {
      const l = this.leafDrops[i];
      l.dist += l.v * dt;
      l.v += 6 * dt;
      if (l.dist > l.pad.r * 0.92) this.leafDrops.splice(i, 1);
    }
  }

  /** 水花落点在荷叶上时调用（由 renderer 判定命中后转化） */
  landOnLeaf(pad: Pad, x: number, y: number, px: number, py: number): void {
    const ang = Math.atan2(y - py, x - px);
    const dist = Math.hypot(x - px, y - py);
    if (this.leafDrops.length < 24) this.leafDrops.push({ pad, ang, dist, r: 1.4 + Math.random(), v: 5 + Math.random() * 7 });
  }

  /** 供 renderer 判定：返回当前飞行的水珠 */
  get flying(): readonly Droplet[] { return this.droplets; }
  get crownsList(): readonly Crown[] { return this.crowns; }
  get onLeaves(): readonly { pad: Pad; ang: number; dist: number; r: number; v: number }[] { return this.leafDrops; }

  drawSurface(ctx: CanvasRenderingContext2D, look: { elementBright: number }): void {
    void look;
    for (const c of this.crowns) {
      const t = c.age / c.life;
      const r = c.s * (0.3 + 0.8 * Math.sqrt(t));
      const a = Math.pow(1 - t, 1.5) * 0.55;
      ctx.strokeStyle = `rgba(240,250,244,${a.toFixed(3)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, r, r * 0.82, 0, 0, Math.PI * 2);
      ctx.stroke();
      // 溅起的短水柱
      const up = Math.sin(Math.min(1, t * 1.6) * Math.PI) * c.s * 0.55;
      if (up > 1) {
        ctx.fillStyle = `rgba(240,250,244,${(a * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.s * 0.22, up, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const d of this.droplets) {
      const a = Math.min(1, d.life - d.age);
      ctx.fillStyle = `rgba(238,250,246,${(0.8 * a).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y - d.z * 0.4, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawLeafDrops(ctx: CanvasRenderingContext2D, plants: Plants, w: number, h: number): void {
    for (const l of this.onLeaves) {
      const [px, py] = plants.screenPos(l.pad, w, h);
      const x = px + Math.cos(l.ang) * l.dist;
      const y = py + Math.sin(l.ang) * l.dist;
      ctx.fillStyle = 'rgba(238,250,250,0.85)';
      ctx.beginPath();
      ctx.arc(x, y, l.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(x - l.r * 0.3, y - l.r * 0.3, l.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
