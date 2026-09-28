import { getLilyPad, getLotus } from '../art/lily';
import { plantSprites } from '../art/plantSprites';
import { getKoiSprites } from '../art/koi';
import type { Critters } from '../core/critters';
import type { Look } from '../core/looks';
import type { Plants } from '../core/plants';
import type { Pond } from '../core/pond';
import { poseSpine } from '../core/spine';
import type { JumpSystem } from '../core/jump';
import { drawStrip } from './strip';
import { drawStrider } from '../art/critters';
import type { Particles } from './particles';

export interface OverlayWorld {
  pond: Pond;
  plants: Plants;
  look: Look;
}

/** 覆盖层：水面之上的一切——荷叶荷花（含遮挡语义）、食物、浮萍、水黾、空中鱼、萤火虫 */
export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, dpr: number,
  world: OverlayWorld,
  critters: Critters,
  particles: Particles,
  jumps: JumpSystem,
  dt: number,
): void {
  const { pond, plants, look } = world;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // ---- 荷叶与荷花（AI 精灵优先，未加载时回退程序化；夜间整体调暗） ----
  const bright = look.elementBright;
  const supportsFilter = 'filter' in ctx;
  const padScale = pond.scale;
  plantSprites.ensure();
  for (const p of plants.pads) {
    const [px, py] = plants.screenPos(p, w, h);
    const grow = 0.35 + 0.65 * p.age;
    const bob = Math.sin(plants.time * 1.1 + p.seed) * 1.4;
    const r = p.r * padScale * grow;
    const rot = p.rot + Math.sin(plants.time * 0.4 + p.seed * 1.7) * 0.03;
    ctx.save();
    ctx.translate(px, py + bob);
    ctx.rotate(rot);
    if (supportsFilter) {
      // 健康度低 → 秋日黄褐感
      ctx.filter = `brightness(${bright.toFixed(3)}) saturate(${(0.75 + 0.25 * (1 - look.sun.nightK)).toFixed(3)}) sepia(${((1 - p.health) * 0.45).toFixed(3)})`;
    }
    const sprite = plantSprites.pad(p.variant);
    if (sprite) {
      ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
    } else {
      const sp = getLilyPad(p.variant, p.health);
      ctx.drawImage(sp.canvas, -r, -r, r * 2, r * 2);
    }
    ctx.restore();
  }
  if (supportsFilter) ctx.filter = 'none';
  for (const l of plants.lotus) {
    const [px, py] = plants.screenPos(l, w, h);
    const openness = plants.lotusOpenness(l, look);
    const bob = Math.sin(plants.time * (0.9 + plants.windK) + l.seed) * 1.6;
    ctx.save();
    ctx.translate(px + Math.sin(plants.time * 0.5 + l.seed) * 1.5, py + bob);
    // 风越大，花头摇得越明显
    ctx.rotate(Math.sin(plants.time * (0.33 + plants.windK * 0.2) + l.seed * 2.3) * (0.03 + 0.09 * plants.windK));
    if (supportsFilter && bright < 0.98) ctx.filter = `brightness(${bright.toFixed(3)})`;
    const flowerSprite = plantSprites.lotus;
    if (l.phase === 'bloom' && flowerSprite && openness > 0.15) {
      // AI 花朵：大小随开放度呼吸
      const r = (14 + 16 * openness) * padScale;
      ctx.drawImage(flowerSprite, -r, -r, r * 2, r * 2);
    } else {
      const sp = getLotus(l.variant, openness, l.phase);
      const r = 26 * padScale * (l.phase === 'bud' ? 0.7 : 1);
      ctx.drawImage(sp.canvas, -r, -r, r * 2, r * 2);
    }
    ctx.restore();
  }
  if (supportsFilter) ctx.filter = 'none';

  // ---- 食物（水面） ----
  for (const p of pond.food) {
    const fade = Math.min(1, p.life / 2);
    const pop = 1 + Math.max(0, 0.25 - p.age) * 1.6;
    const s = 0.72 * pop * (1 + Math.sin(performance.now() * 0.002 + p.drift) * 0.04) * pond.scale;
    ctx.fillStyle = `rgba(222,192,132,${(0.95 * fade).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,236,190,${(0.5 * fade).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x - s * 0.3, p.y - s * 0.3, s * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 浮萍 ----
  ctx.fillStyle = 'rgba(96,152,96,0.85)';
  for (const wd of critters.weeds) {
    ctx.beginPath();
    ctx.ellipse(wd.nx * w, wd.ny * h, 2.6 * wd.s * pond.scale, 2 * wd.s * pond.scale, wd.seed, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 水黾（水面层） ----
  for (const s of critters.striders) {
    drawStrider(ctx, s.x, s.y, Math.atan2(s.ty - s.y, s.tx - s.x), 7 * pond.scale);
  }

  // ---- 跃出水面的鱼（空中段） ----
  const j = jumps.active;
  if (j && j.fish.spine && j.fish.depth < 0) {
    const f = j.fish;
    const sp = getKoiSprites(f.palette, f.seed);
    const s = f.size * pond.scale;
    const pose = poseSpine(f, s, this_pose());
    // 空中的鱼带水光拖尾
    ctx.globalAlpha = 0.5;
    drawStrip(ctx, sp.shadows[1], pose, s, f.x * pond.width, f.y * pond.height, 1.1);
    ctx.globalAlpha = 1;
    drawStrip(ctx, sp.body, pose, s, f.x * pond.width, f.y * pond.height, 1.1);
  }

  // ---- 水花与飞溅水珠 ----
  particles.drawSurface(ctx, look);

  // ---- 萤火虫（夜里，发光体不受暗化） ----
  const nk = look.sun.nightK;
  if (nk > 0.05) {
    const t = performance.now() * 0.001;
    if (FIREFLIES.length === 0) {
      for (let i = 0; i < 22; i++) {
        FIREFLIES.push({ x: Math.random() * w, y: Math.random() * h * 0.75, seed: Math.random() * 100, sp: 0.8 + Math.random() * 0.8, z: 0.4 + Math.random() * 0.6 });
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const f of FIREFLIES) {
      f.x += Math.sin(t * 0.13 * f.sp + f.seed) * 22 * dt;
      f.y += Math.cos(t * 0.11 * f.sp + f.seed * 2) * 16 * dt;
      if (f.x < -10) f.x = w + 10;
      if (f.x > w + 10) f.x = -10;
      if (f.y < -10) f.y = h * 0.8;
      if (f.y > h * 0.85) f.y = -10;
      const glow = Math.pow(Math.max(0, Math.sin(t * 1.3 * f.sp + f.seed * 3)), 3) * nk;
      if (glow < 0.02) continue;
      ctx.fillStyle = `rgba(190,255,150,${(glow * 0.35).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, (3 + 2 * f.z) * pond.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,210,${(glow * 0.85).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// 萤火虫的持久状态（模块级）
const FIREFLIES: { x: number; y: number; seed: number; sp: number; z: number }[] = [];

// 临时 pose 缓冲（单鱼复用）
const _pose = new Float32Array(68);
function this_pose(): Float32Array { return _pose; }
