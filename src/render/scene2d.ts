import { getKoiSprites } from '../art/koi';
import { drawMinnow, drawBubble, drawSnail, drawShrimp } from '../art/critters';
import { plantSprites } from '../art/plantSprites';
import { bodyHalfWidth, girthOf, KOI_BODY, SEG_UNITS } from '../core/body';
import type { MinnowSchool } from '../core/minnow';
import type { Plants } from '../core/plants';
import type { Critters } from '../core/critters';
import type { TurtleSystem } from '../core/turtle';
import { poseSpine } from '../core/spine';
import type { Fish } from '../core/types';
import { PALETTES } from '../core/types';
import type { Pond } from '../core/pond';
import type { Look } from '../core/looks';
import { clamp } from '../core/utils';
import { drawFin, drawStrip } from './strip';

export interface SceneWorld {
  pond: Pond;
  plants: Plants;
  school: MinnowSchool;
  critters: Critters;
  turtles: TurtleSystem;
  look: Look;
}

/**
 * 水下场景层：池底 → 叶影 → 底栖生物 → 小鱼群 → 鱼影 → 鱼（带深度雾）→ 泡泡。
 * 绘制到离屏画布，交由 GL 水面合成；降级模式下直接画在可见画布上。
 */
export class Scene2D {
  private scratch: HTMLCanvasElement;
  private scratchCtx: CanvasRenderingContext2D;
  private pose = new Float32Array((KOI_BODY.segments + 1) * 4);
  private dpr = 1;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    this.scratch = document.createElement('canvas');
    this.scratch.width = 320;
    this.scratch.height = 160;
    this.scratchCtx = this.scratch.getContext('2d')!;
  }

  render(
    ctx: CanvasRenderingContext2D,
    w: number, h: number, dpr: number,
    world: SceneWorld,
    bed: HTMLImageElement | null,
  ): void {
    this.dpr = dpr;
    this.ctx = ctx;
    const { pond, plants, critters, school, turtles, look } = world;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (bed) {
      const iw = bed.width, ih = bed.height;
      const s = Math.max(w / iw, h / ih);
      ctx.drawImage(bed, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);
    } else {
      ctx.fillStyle = '#17332f';
      ctx.fillRect(0, 0, w, h);
    }

    // 荷叶/荷花的影子投在池底：方向与长度随太阳时刻变化
    const sd = look.sun.shadowDir;
    const off = 10 * look.sun.shadowLen * pond.scale;
    ctx.fillStyle = `rgba(8,26,24,${(0.16 * (0.4 + 0.6 * look.sun.intensity) + 0.04).toFixed(3)})`;
    for (const p of plants.pads) {
      const [px, py] = plants.screenPos(p, w, h);
      ctx.beginPath();
      ctx.ellipse(px + sd[0] * off, py + sd[1] * off, p.r * pond.scale * 1.02, p.r * pond.scale * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const l of plants.lotus) {
      const [px, py] = plants.screenPos(l, w, h);
      ctx.beginPath();
      ctx.ellipse(px + sd[0] * off * 1.1, py + sd[1] * off * 1.1, 20 * pond.scale, 17 * pond.scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 底栖：螺蛳、青虾
    for (const s of critters.snails) {
      drawSnail(ctx, s.nx * w, s.ny * h, s.angle, 9 * pond.scale, s.variant);
    }
    for (const s of critters.shrimps) {
      drawShrimp(ctx, s.nx * w, s.ny * h, s.angle, 10 * pond.scale);
    }

    // 乌龟（水下巡游；精灵头朝上 → 旋转到运动方向）
    for (const t of turtles.turtles) {
      const sp = plantSprites.turtle(t.variant);
      const s = 46 * pond.scale;
      const tx = t.nx * w, ty = t.ny * h;
      const dir = look.sun.shadowDir;
      const tOff = (8 + (1 - t.depth) * 26) * pond.scale * look.sun.shadowLen;
      ctx.fillStyle = `rgba(8,26,24,${(0.2 * (0.4 + 0.6 * look.sun.intensity)).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(tx + dir[0] * tOff, ty + dir[1] * tOff, s * 0.52, s * 0.46, t.angle, 0, Math.PI * 2);
      ctx.fill();
      if (sp) {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(t.angle + Math.PI / 2);
        const fogT = 0.04 + t.depth * 0.2;
        ctx.globalAlpha = 1 - fogT;
        ctx.drawImage(sp, -s / 2, -s / 2, s, s);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    // 小鱼群（略深，带一点雾感）
    ctx.globalAlpha = 0.88;
    for (const f of school.fish) {
      drawMinnow(ctx, f.x * w, f.y * h, school.heading(f), 2.6 * pond.scale, f.panic > 0 ? 1 : 0);
    }
    ctx.globalAlpha = 1;

    // 鱼影 + 鱼（跃出水面 depth<0 的除外）
    const list = pond.fish.filter((f) => f.spine && f.depth >= 0).sort((a, b) => b.depth - a.depth);
    for (const f of list) this.drawShadow(pond, f, look);
    for (const f of list) this.drawKoi(pond, f, look);

    // 泡泡
    for (const b of critters.bubbles) drawBubble(ctx, b.x, b.y, b.r * pond.scale);
  }

  private drawShadow(pond: Pond, f: Fish, look: Look): void {
    const sp = getKoiSprites(f.palette, f.seed);
    const s = f.size * pond.scale;
    const k = (1 - Math.max(0, f.depth) * 0.09) * 1.06;
    const pose = poseSpine(f, s, this.pose);
    const dir = look.sun.shadowDir;
    const off = (10 + (1 - Math.max(0, f.depth)) * 46) * pond.scale * look.sun.shadowLen;
    const dx = dir[0] * off, dy = dir[1] * off;
    const a = (0.95 - (1 - Math.max(0, f.depth)) * 0.25) * (0.45 + 0.55 * look.sun.intensity) * (1 - look.sun.nightK * 0.8);
    const level = f.depth > 0.65 ? 0 : f.depth > 0.35 ? 1 : 2;
    const ctx = this.ctx!;
    ctx.globalAlpha = Math.max(0.06, a);
    drawStrip(ctx, sp.shadows[level], pose, s, f.x * pond.width + dx, f.y * pond.height + dy, k);
    ctx.globalAlpha = 1;
  }

  private drawKoi(pond: Pond, f: Fish, look: Look): void {
    const sp = getKoiSprites(f.palette, f.seed);
    const s = f.size * pond.scale;
    const depth = Math.max(0, f.depth);
    const k = 1 - depth * 0.09;
    const pose = poseSpine(f, s, this.pose);
    const cx = f.x * pond.width, cy = f.y * pond.height;
    const ctx = this.ctx!;

    const L = KOI_BODY.length * s;
    const bl = f.v / L;
    const baseSpread = 1.05 - 0.6 * clamp(bl / 1.4, 0, 1) + (f.thrust < 0.3 ? Math.sin(performance.now() * 0.0042 + f.seed) * 0.16 : 0);
    const girth = girthOf(f.seed);
    const pal = PALETTES[f.palette % PALETTES.length];
    const fins: [number, number, number][] = [[4, 0.95, 1], [8, 0.55, 0.58]];
    for (const [i, spreadK, size] of fins) {
      const px = pose[i * 4], py = pose[i * 4 + 1], nx = pose[i * 4 + 2], ny = pose[i * 4 + 3];
      const heading = Math.atan2(-nx, ny);
      const hw = bodyHalfWidth(KOI_BODY.nose - i * SEG_UNITS, girth, pal.kind) * s * 0.8;
      for (const side of [1, -1] as const) {
        const spread = (baseSpread + clamp(side * f.turn * 0.35, -0.3, 0.5)) * spreadK;
        const ang = heading + side * (Math.PI - spread);
        const X = cx + (px + nx * hw * side - cx) * k;
        const Y = cy + (py + ny * hw * side - cy) * k;
        const fs = s * k * 0.85 * size;
        drawFin(ctx, sp, X, Y, ang, fs, side);
      }
    }

    const fogA = 0.02 + depth * 0.22;
    const tint = look.elementTint;
    const fog: [number, number, number] = [
      172 * tint[0] * look.bright,
      204 * tint[1] * look.bright,
      194 * tint[2] * look.bright,
    ];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i <= KOI_BODY.segments; i++) {
      minX = Math.min(minX, pose[i * 4]);
      maxX = Math.max(maxX, pose[i * 4]);
      minY = Math.min(minY, pose[i * 4 + 1]);
      maxY = Math.max(maxY, pose[i * 4 + 1]);
    }
    const pad = 20 * s * k + 6;
    const bx = minX - pad, by = minY - pad;
    const bw = maxX - minX + pad * 2, bh = maxY - minY + pad * 2;
    const sw = Math.ceil(bw * this.dpr), sh = Math.ceil(bh * this.dpr);
    if (this.scratch.width < sw || this.scratch.height < sh) {
      this.scratch.width = Math.max(this.scratch.width, sw);
      this.scratch.height = Math.max(this.scratch.height, sh);
    }
    const g = this.scratchCtx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.scratch.width, this.scratch.height);
    g.setTransform(this.dpr, 0, 0, this.dpr, -bx * this.dpr, -by * this.dpr);
    drawStrip(g, sp.body, pose, s, cx, cy, k);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(${fog[0] | 0},${fog[1] | 0},${fog[2] | 0},${fogA.toFixed(3)})`;
    g.fillRect(bx, by, bw, bh);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.scratch, 0, 0, sw, sh, bx, by, bw, bh);
  }
}
