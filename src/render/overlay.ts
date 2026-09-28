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

  // ---- 荷叶与荷花（AI 精灵优先，未加载时回退程序化；着色走缓存，零每帧 filter） ----
  const bright = look.elementBright;
  const padScale = pond.scale;
  plantSprites.ensure();
  const satQ = q(0.75 + 0.25 * (1 - look.sun.nightK), 0.1);
  const brightQ = q(bright, 0.04);
  for (const p of plants.pads) {
    const [px, py] = plants.screenPos(p, w, h);
    const grow = 0.35 + 0.65 * p.age;
    const bob = Math.sin(plants.time * 1.1 + p.seed) * 1.4;
    const r = p.r * padScale * grow;
    const rot = p.rot + Math.sin(plants.time * 0.4 + p.seed * 1.7) * 0.03;
    const sprite = plantSprites.pad(p.variant);
    const src = sprite ?? getLilyPad(p.variant, p.health).canvas;
    const filtered = tinted(src, brightQ, satQ, q((1 - p.health) * 0.45, 0.1));
    ctx.save();
    ctx.translate(px, py + bob);
    ctx.rotate(rot);
    ctx.drawImage(filtered, -r, -r, r * 2, r * 2);
    ctx.restore();
  }
  for (const l of plants.lotus) {
    // 茎：从水底锚点到花头的弯曲短茎（弹簧摆动），花头挂在茎端
    const baseX = l.nx * w + Math.sin(plants.time * 0.11 + l.nx * 40) * 3;
    const baseY = l.ny * h + Math.cos(plants.time * 0.13 + l.ny * 50) * 3;
    const sway = l.swayA;
    const len = 24 * padScale;
    const headX = baseX + Math.sin(sway) * len;
    const headY = baseY - len * 0.22 + Math.cos(plants.time * (0.9 + plants.windK) + l.seed) * 1.2;
    ctx.save();
    if (brightQ < 0.99) ctx.filter = `brightness(${brightQ.toFixed(3)})`;
    // 茎身（深绿→浅绿，随摆动弯曲）
    ctx.strokeStyle = 'rgba(74,112,58,0.9)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.2 * padScale;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(baseX + Math.sin(sway) * len * 0.35, baseY - len * 0.08, headX, headY + 6 * padScale);
    ctx.stroke();
    ctx.lineWidth = 1.6 * padScale;
    ctx.strokeStyle = 'rgba(126,160,92,0.85)';
    ctx.stroke();
    // 花头挂在茎端，随摆微转
    ctx.translate(headX, headY);
    ctx.rotate(sway * 0.6);
    const openness = plants.lotusOpenness(l, look);
    drawLotusState(ctx, l, openness, padScale);
    ctx.filter = 'none';
    ctx.restore();
  }

  // ---- 食物（水面）：AI 鱼食粒优先 ----
  const pellet = plantSprites.pellet;
  for (const p of pond.food) {
    const fade = Math.min(1, p.life / 2);
    const pop = 1 + Math.max(0, 0.25 - p.age) * 1.6;
    const s = 0.72 * pop * (1 + Math.sin(performance.now() * 0.002 + p.drift) * 0.04) * pond.scale;
    if (pellet) {
      ctx.globalAlpha = 0.95 * fade;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.drift);
      ctx.drawImage(pellet, -s * 1.4, -s * 1.4, s * 2.8, s * 2.8);
      ctx.restore();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = `rgba(222,192,132,${(0.95 * fade).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,236,190,${(0.5 * fade).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x - s * 0.3, p.y - s * 0.3, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
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

// ---- S2：着色精灵缓存。量化亮度/饱和/枯黄到桶位，预渲染后纯 drawImage，消灭每帧 ctx.filter ----
const tintCache = new Map<string, HTMLCanvasElement>();
function tinted(img: HTMLImageElement | HTMLCanvasElement, bright: number, sat: number, sepia: number): HTMLCanvasElement {
  const key = `${bright.toFixed(2)}|${sat.toFixed(1)}|${sepia.toFixed(1)}|${img.width}x${img.height}`;
  const hit = tintCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d')!;
  g.filter = `brightness(${bright.toFixed(3)}) saturate(${sat.toFixed(3)}) sepia(${sepia.toFixed(3)})`;
  g.drawImage(img, 0, 0);
  if (tintCache.size > 48) tintCache.delete(tintCache.keys().next().value!);
  tintCache.set(key, c);
  return c;
}
const q = (v: number, step: number) => Math.round(v / step) * step;

/** 荷花三态交叉淡化：花苞 → 半开 → 盛放（AI 精灵），缺失态回退程序化绘制 */
function drawLotusState(ctx: CanvasRenderingContext2D, l: { variant: number; phase: 'bud' | 'bloom' | 'seedpod' }, openness: number, padScale: number): void {
  const r0 = 26 * padScale;
  if (l.phase === 'seedpod') {
    const sp = getLotus(l.variant, 0, 'seedpod');
    ctx.drawImage(sp.canvas, -r0, -r0, r0 * 2, r0 * 2);
    return;
  }
  const full = plantSprites.lotus;
  const half = plantSprites.lotusHalf;
  const bud = plantSprites.lotusBud;
  const smooth = (a: number, b: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  if (!full || !half || !bud) {
    // 回退：程序化（其内部按 openness 画花瓣张角）
    const sp = getLotus(l.variant, openness, l.phase);
    const r = r0 * (l.phase === 'bud' ? 0.7 : 1);
    ctx.drawImage(sp.canvas, -r, -r, r * 2, r * 2);
    return;
  }
  // 苞：openness 低时可见
  const aBud = (1 - smooth(0.22, 0.5, openness)) * smooth(0, 0.1, openness);
  const aHalf = smooth(0.25, 0.45, openness) * (1 - smooth(0.62, 0.85, openness));
  const aFull = smooth(0.62, 0.88, openness);
  if (aBud > 0.02) {
    ctx.globalAlpha = aBud;
    const r = r0 * 0.6;
    ctx.drawImage(bud, -r, -r, r * 2, r * 2);
  }
  if (aHalf > 0.02) {
    ctx.globalAlpha = aHalf;
    const r = r0 * 0.82;
    ctx.drawImage(half, -r, -r, r * 2, r * 2);
  }
  if (aFull > 0.02) {
    ctx.globalAlpha = aFull;
    const r = r0;
    ctx.drawImage(full, -r, -r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}
