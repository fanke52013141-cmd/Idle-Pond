import { makeRng } from '../core/rng';
import { TAU } from '../core/utils';

export interface PadSprite { canvas: HTMLCanvasElement; radius: number }
export interface LotusSprite { canvas: HTMLCanvasElement; radius: number }

const padCache = new Map<string, PadSprite>();
const lotusCache = new Map<string, LotusSprite>();

/** 程序化荷叶：径向叶脉 + 缺口 + 杯状明暗 + 防水高光 */
export function getLilyPad(variant: number, health: number, ppu = 2): PadSprite {
  const v = ((variant % 4) + 4) % 4;
  const h = Math.round(clamp01(health) * 12) / 12; // 量化以便缓存
  const key = `pad:${v}:${h}`;
  const hit = padCache.get(key);
  if (hit) return hit;

  const R = 60;
  const S = R * 2 * ppu;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(S);
  const ctx = c.getContext('2d')!;
  const rng = makeRng(v * 977 + 13);
  const notchA = (rng() - 0.5) * 1.1 + v * 0.7;
  const notchW = 0.28 + rng() * 0.16;

  ctx.scale(ppu, ppu);
  ctx.translate(R, R);

  // 叶缘（微卷立体感）：外圈深 → 内圈亮
  const g = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
  const green = (base: number, k: number) => Math.round(lerpNum(base, base * 0.55, 1 - h) * k);
  g.addColorStop(0, `rgb(${green(150, 1.12)},${green(205, 1.05)},${green(150, 1.05)})`);
  g.addColorStop(0.55, `rgb(${green(126, 1)},${green(188, 1)},${green(126, 1)})`);
  g.addColorStop(0.85, `rgb(${green(104, 1)},${green(166, 1)},${green(112, 1)})`);
  g.addColorStop(1, `rgb(${green(76, 1)},${green(128, 1)},${green(86, 1)})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();

  // 缺口（荷叶标志性的放射状切口）
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, R + 2, notchA - notchW / 2, notchA + notchW / 2);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // 叶脉：从中心放射，避开缺口
  ctx.strokeStyle = `rgba(${green(70, 1)},${green(118, 1)},${green(78, 1)},0.5)`;
  ctx.lineWidth = 1.1;
  const veins = 17;
  for (let i = 0; i < veins; i++) {
    const a = (i / veins) * TAU;
    let da = a - notchA;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) < notchW / 2 + 0.12) continue;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(Math.cos(a) * (R - 2.5), Math.sin(a) * (R - 2.5));
    ctx.stroke();
  }

  // 中心点与防水高光
  ctx.fillStyle = `rgba(${green(64, 1)},${green(110, 1)},${green(74, 1)},0.8)`;
  ctx.beginPath();
  ctx.arc(0, 0, 2.6, 0, TAU);
  ctx.fill();
  const sheen = ctx.createRadialGradient(-R * 0.3, -R * 0.35, 0, -R * 0.3, -R * 0.35, R * 0.75);
  sheen.addColorStop(0, 'rgba(235,255,240,0.16)');
  sheen.addColorStop(1, 'rgba(235,255,240,0)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, TAU);
  ctx.fill();

  const sprite = { canvas: c, radius: R * ppu };
  padCache.set(key, sprite);
  return sprite;
}

/** 程序化荷花：顶视角放射花瓣；openness 0=花苞 1=盛放；phase 覆盖为莲蓬 */
export function getLotus(variant: number, openness: number, phase: 'bud' | 'bloom' | 'seedpod', ppu = 2): LotusSprite {
  const o = Math.round(clamp01(openness) * 10) / 10;
  const key = `lotus:${variant}:${o}:${phase}`;
  const hit = lotusCache.get(key);
  if (hit) return hit;

  const R = 40;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(R * 2 * ppu);
  const ctx = c.getContext('2d')!;
  const rng = makeRng(variant * 613 + 7);
  ctx.scale(ppu, ppu);
  ctx.translate(R, R);

  if (phase === 'seedpod') {
    // 莲蓬：黄绿圆锥顶 + 莲子孔
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, R * 0.42);
    g.addColorStop(0, '#c8d06a');
    g.addColorStop(1, '#7f9646');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4c5e2a';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + rng();
      const r = R * (i === 0 ? 0 : 0.24);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2.4, 0, TAU);
      ctx.fill();
    }
  } else if (o < 0.12) {
    // 花苞：闭合的水滴形
    const g = ctx.createLinearGradient(0, -R * 0.55, 0, R * 0.3);
    g.addColorStop(0, '#e8b7c4');
    g.addColorStop(0.6, '#d98ba4');
    g.addColorStop(1, '#7c9a58');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.58);
    ctx.bezierCurveTo(R * 0.34, -R * 0.3, R * 0.3, R * 0.18, 0, R * 0.3);
    ctx.bezierCurveTo(-R * 0.3, R * 0.18, -R * 0.34, -R * 0.3, 0, -R * 0.58);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,120,60,0.5)';
    ctx.lineWidth = 1.4;
    for (const s of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 2.2, R * 0.26);
      ctx.quadraticCurveTo(s * 6.5, -R * 0.08, s * 3.4, -R * 0.5);
      ctx.stroke();
    }
  } else {
    // 盛放：外 8 瓣 + 内 6 瓣 + 花蕊；openness 控制展开半径
    const spread = 0.55 + o * 0.45;
    const petal = (a: number, len: number, wid: number, lerpT: number) => {
      const px = Math.cos(a), py = Math.sin(a);
      const g = ctx.createLinearGradient(px * len * 0.2, py * len * 0.2, px * len, py * len);
      g.addColorStop(0, `rgba(250,240,244,0.98)`);
      g.addColorStop(0.55, `rgba(${Math.round(lerpNum(244, 232, lerpT))},${Math.round(lerpNum(196, 168, lerpT))},${Math.round(lerpNum(212, 190, lerpT))},0.96)`);
      g.addColorStop(1, `rgba(214,118,148,0.92)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(px * len * 0.12 - py * wid * 0.25, py * len * 0.12 + px * wid * 0.25);
      ctx.quadraticCurveTo(px * len * 0.62 - py * wid * 0.62, py * len * 0.62 + px * wid * 0.62, px * len, py * len);
      ctx.quadraticCurveTo(px * len * 0.62 + py * wid * 0.62, py * len * 0.62 - px * wid * 0.62, px * len * 0.12 + py * wid * 0.25, py * len * 0.12 - px * wid * 0.25);
      ctx.fill();
    };
    const rot = rng() * TAU;
    for (let i = 0; i < 8; i++) petal(rot + (i / 8) * TAU, R * spread, R * 0.34 * spread, 1);
    for (let i = 0; i < 6; i++) petal(rot + 0.4 + (i / 6) * TAU, R * spread * 0.66, R * 0.3 * spread, 0.45);
    // 花蕊
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.3 * spread + 2);
    cg.addColorStop(0, '#f6d766');
    cg.addColorStop(1, 'rgba(230,190,80,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.3 * spread + 2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e9c34a';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rot;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * R * 0.14, Math.sin(a) * R * 0.14, 1.5, 0, TAU);
      ctx.fill();
    }
  }

  const sprite = { canvas: c, radius: R * ppu };
  lotusCache.set(key, sprite);
  return sprite;
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
