import { bodyHalfWidth, KOI_BODY, SPRITE_WIDTH, girthOf } from '../core/body';
import { fbm, makeValueNoise } from '../core/noise';
import { hash1, makeRng } from '../core/rng';
import { PALETTES, type KoiKind, type KoiPalette } from '../core/types';
import { clamp, clamp01, hexRgb, lerp, smoothstep, TAU } from '../core/utils';

export interface KoiSprites {
  body: HTMLCanvasElement;
  fin: HTMLCanvasElement;
  finPx: number; // 胸鳍贴图的枢轴（相对宽高的比例）
  finPy: number;
  shadows: HTMLCanvasElement[]; // 由锐到糊的三级剪影
  ppu: number;
}

const cache = new Map<string, KoiSprites>();

export function getKoiSprites(palIdx: number, seed: number, ppu = 3): KoiSprites {
  const key = `${palIdx}:${seed}:${ppu}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pal = PALETTES[palIdx % PALETTES.length];
  const girth = girthOf(seed);
  const body = paintBody(pal, seed, girth, ppu);
  const fin = paintFin(pal, ppu);
  const flat = silhouette(body);
  const sprites: KoiSprites = {
    body,
    fin: fin.canvas,
    finPx: fin.px,
    finPy: fin.py,
    // 贴图是屏幕的 ~3 倍超采样，模糊半径要按 3 倍给才有可见的柔边
    shadows: [flat, blurCanvas(flat, 3), blurCanvas(flat, 7)],
    ppu,
  };
  if (cache.size > 40) cache.delete(cache.keys().next().value!);
  cache.set(key, sprites);
  return sprites;
}

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext('2d')!];
}

function silhouette(src: HTMLCanvasElement): HTMLCanvasElement {
  const [c, ctx] = canvasOf(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

function blurCanvas(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  const [c, ctx] = canvasOf(src.width, src.height);
  ctx.filter = `blur(${px}px)`;
  ctx.drawImage(src, 0, 0);
  return c;
}

// ---------------- 斑纹场 ----------------

/** 色斑/墨斑的距离场：正值在斑内。不同品种不同构法 */
function makePatchField(kind: KoiKind, seed: number) {
  const rng = makeRng(seed * 7919 + 11);
  const n1 = makeValueNoise(seed + 1);
  const n2 = makeValueNoise(seed + 2);
  const ox = rng() * 40, oy = rng() * 40;
  const th = 0.5 + (rng() - 0.5) * 0.12;
  const headRed = rng() < 0.7;
  const band = rng() * TAU;
  const capX = 20 + rng() * 6, capR = 5 + rng() * 1.5;
  const hi = (x: number, y: number): number => {
    if (kind === 'kohaku' || kind === 'sanke') {
      let v = fbm(n1, x * 0.07 + ox, y * 1.05 + oy) + 0.14 * Math.sin(x * 0.16 + band) - 0.5;
      if (headRed) v += 0.2 * smoothstep(17, 25, x);
      return v - th + 0.5 - 0.6 * smoothstep(30.5, 33.5, x) - 0.08 * smoothstep(0.7, 1, Math.min(1, Math.abs(y)));
    }
    if (kind === 'tancho') {
      return (capR - Math.hypot(x - capX, y) - (n1(x * 0.5 + ox, y * 0.5 + oy) - 0.5) * 1.4) * 0.06;
    }
    return -1;
  };
  const sumi = (x: number, y: number): number => {
    if (kind === 'sanke') return fbm(n2, x * 0.2 + ox, y * 1.8 + oy, 3) - 0.72 - 0.3 * smoothstep(13, 19, x);
    if (kind === 'utsuri') {
      const v = fbm(n1, x * 0.06 + ox, y * 0.9 + oy) + 0.12 * Math.sin(x * 0.13 + band) - 0.5;
      return v - th + 0.5 - 0.04;
    }
    return -1;
  };
  return { hi, sumi };
}

// ---------------- 鳞片 ----------------

interface ScaleCell { on: boolean; r: number; dx: number; id: number }
const sc: ScaleCell = { on: false, r: 2, dx: 0, id: 0 };

/**
 * 覆盖 (x,y) 的可见鳞片：错位网格 + 随机抖动；行距沿圆背弧长展开，
 * 所以鳞片在体侧自然收窄。可见者是覆盖该点、位置最靠头的 kz 片。
 */
function scaleAt(x: number, y: number, w: number): ScaleCell {
  sc.on = false;
  sc.r = 2;
  const ys = Math.asin(clamp(y / w, -0.999, 0.999)) * w;
  const sx = 1.85, sy = 1.55, R = sx * 0.74;
  const row = Math.round(ys / sy);
  let best = -1e9;
  for (let rr = row - 1; rr <= row + 1; rr++) {
    const cy = rr * sy;
    const off = rr & 1 ? sx * 0.5 : 0;
    const col = Math.round((x - off) / sx);
    for (let cc = col - 1; cc <= col + 1; cc++) {
      const cx = cc * sx + off + (hash1(rr * 13.1 + cc * 7.7) - 0.5) * sx * 0.22;
      const d = Math.hypot(x - cx, ys - cy - (hash1(rr * 5.3 - cc * 11.9) - 0.5) * sy * 0.18);
      if (d < R && cx > best) {
        best = cx;
        sc.on = true;
        sc.r = d / R;
        sc.id = rr * 997 + cc;
        sc.dx = (x - cx) / R;
      }
    }
  }
  return sc;
}

// ---------------- 身体贴图 ----------------

function paintBody(pal: KoiPalette, seed: number, girth: number, ppu: number): HTMLCanvasElement {
  const W = Math.round(SPRITE_WIDTH * ppu), H = Math.round(KOI_BODY.spriteHalf * 2 * ppu);
  const N = W * H;
  const kind = pal.kind;
  const pat = makePatchField(kind, seed);
  const grain = makeValueNoise(seed + 7);
  const base = hexRgb(pal.base), spotC = hexRgb(pal.spot), sumiC = hexRgb(pal.second ?? pal.spot), finC = hexRgb(pal.fin);
  const hiDeep = [spotC[0] * 0.86, spotC[1] * 0.86, spotC[2] * 0.86];
  const hiEdge = [lerp(spotC[0], 238, 0.35), lerp(spotC[1], 128, 0.35), lerp(spotC[2], 74, 0.35)];
  const patterned = kind === 'kohaku' || kind === 'sanke' || kind === 'utsuri' || kind === 'tancho';
  const pedHi = pat.hi(-26, 0) > 0;
  const pedSumi = pat.sumi(-26, 0) > 0;

  const alb = new Float32Array(N * 3);
  const alpha = new Float32Array(N);
  const shade = new Float32Array(N);
  const spec = new Float32Array(N);
  const finA = new Float32Array(N);
  const finRGB = new Float32Array(N * 3);

  for (let py = 0; py < H; py++) {
    const y = (py + 0.5) / ppu - KOI_BODY.spriteHalf;
    const ay = Math.abs(y);
    for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / ppu + KOI_BODY.spriteLeft;
      const i = py * W + px;
      const w = bodyHalfWidth(x, girth);

      // ---- 身体 ----
      if (w > 0) {
        const cov = clamp01((w - ay) * ppu + 0.5);
        if (cov > 0) {
          const v = clamp(y / w, -1, 1);
          const nz = Math.sqrt(Math.max(0, 1 - v * v));
          let c0: number, c1: number, c2: number;
          if (kind === 'ogon') {
            // 黄金：亮金聚在背脊，体侧沉为深琥珀，头部更柔
            const k = Math.pow(nz, 1.4);
            c0 = lerp(166, 228, k); c1 = lerp(104, 172, k); c2 = lerp(22, 52, k);
            const head = smoothstep(18, 28, x) * k * 0.3;
            c0 = lerp(c0, 234, head); c1 = lerp(c1, 184, head); c2 = lerp(c2, 84, head);
          } else if (kind === 'beni') {
            // 绯鲤：背脊深绯，向体侧暖化为朱橙，头部略亮
            const flank = smoothstep(0.15, 0.95, Math.abs(v)), head = smoothstep(16, 24, x);
            c0 = lerp(lerp(176, 222, flank), 214, head * 0.5);
            c1 = lerp(lerp(34, 70, flank), 66, head * 0.5);
            c2 = lerp(lerp(26, 42, flank), 44, head * 0.5);
          } else if (kind === 'sumi') {
            const side = smoothstep(0.62, 1, Math.abs(v)) * 0.5;
            c0 = lerp(44, 92, side); c1 = lerp(51, 104, side); c2 = lerp(50, 100, side);
          } else {
            c0 = base[0]; c1 = base[1]; c2 = base[2];
            const flank = smoothstep(0.7, 1, Math.abs(v)) * 0.3 + smoothstep(29, 33, x) * 0.3;
            c0 = lerp(c0, 236, flank); c1 = lerp(c1, 214, flank); c2 = lerp(c2, 202, flank);
          }

          let spExtra = 0;
          if (patterned) {
            const f0 = pat.hi(x, y);
            const hi = smoothstep(-0.045, 0.035, f0);
            if (hi > 0) {
              const edgeK = 1 - smoothstep(0, 0.12, f0);
              c0 = lerp(c0, lerp(hiDeep[0], hiEdge[0], edgeK), hi);
              c1 = lerp(c1, lerp(hiDeep[1], hiEdge[1], edgeK), hi);
              c2 = lerp(c2, lerp(hiDeep[2], hiEdge[2], edgeK), hi);
            }
            const f1 = pat.sumi(x, y);
            const su = smoothstep(-0.03, 0.02, f1);
            if (su > 0) {
              c0 = lerp(c0, sumiC[0], su); c1 = lerp(c1, sumiC[1], su); c2 = lerp(c2, sumiC[2], su);
            }
          }

          // 鳞片： tone + 前缘口袋阴影 + 后缘受光带 + 细暗边
          const zone = smoothstep(17, 13, x) * smoothstep(-30, -25, x) * smoothstep(0.99, 0.86, Math.abs(v));
          let onScale = false;
          if (zone > 0.01) {
            const cell = scaleAt(x, y, w);
            onScale = cell.on && cell.r <= 1;
            if (onScale) {
              const tone = 1 + (hash1(cell.id + seed) - 0.5) * 0.05 * zone;
              c0 *= tone; c1 *= tone; c2 *= tone;
              const back = smoothstep(0.1, -0.5, cell.dx);
              const pocket = smoothstep(-0.35, 0.75, cell.dx) * (1 - smoothstep(0.86, 1, cell.r)) * zone;
              const edgeLine = smoothstep(0.84, 0.98, cell.r) * back * zone;
              const band = smoothstep(0.5, 0.78, cell.r) * (1 - smoothstep(0.84, 0.95, cell.r)) * back * zone;
              const k = 1 - pocket * 0.06 - edgeLine * 0.11;
              c0 = lerp(c0 * k, 255, band * 0.1);
              c1 = lerp(c1 * k, 253, band * 0.1);
              c2 = lerp(c2 * k, 246, band * 0.1);
              spExtra += band * 0.05;
              if (hash1(cell.id * 3.1 + seed) > 0.955) spExtra += (1 - cell.r) * zone * 0.06;
            }
          }

          // 伏贴的背鳍：中脊深线 + 半透明鳍膜
          const alongD = smoothstep(-23, -17, x) * smoothstep(10, 5, x);
          if (alongD > 0) {
            const core = smoothstep(0.6, 0.1, ay) * alongD * 0.2;
            const mem = smoothstep(1.7, 0.6, ay) * alongD * (0.6 + 0.4 * Math.sin(x * 3.4)) * 0.1;
            c0 = lerp(lerp(c0, finC[0], mem), c0 * 0.62, core);
            c1 = lerp(lerp(c1, finC[1], mem), c1 * 0.64, core);
            c2 = lerp(lerp(c2, finC[2], mem), c2 * 0.66, core);
          }

          // 大尺度斑驳，避免任何纯平色块
          const mot = 0.94 + 0.12 * fbm(grain, x * 0.09 + 40, y * 0.14, 3);
          c0 *= mot; c1 *= mot; c2 *= mot;

          // 圆背明暗（体积感的来源）与高光
          const sh = 0.62 + 0.38 * Math.pow(nz, 0.65) - 0.1 * smoothstep(0.72, 1, Math.abs(v));
          const sp = 0.07 * Math.pow(nz, 6) + smoothstep(17, 25, x) * Math.pow(nz, 4) * 0.045 + spExtra;

          alb[i * 3] = c0; alb[i * 3 + 1] = c1; alb[i * 3 + 2] = c2;
          alpha[i] = cov;
          shade[i] = sh;
          spec[i] = sp;
        }
      }

      // ---- 尾鳍（叉形、半透明、细鳍条） ----
      if (x < -23 && x > -57.5) {
        const tailU = clamp01((-26 - x) / 26);
        const span = 3.2 + 9.4 * Math.pow(tailU, 0.85);
        const wob = (grain(x * 0.5, y * 0.5) - 0.5) * 1.2;
        const endX = -47 - 9 * Math.pow(Math.min(1, ay / 11.5), 1.6) + wob;
        const edge = Math.min(span - ay, x - endX, -23 - x);
        if (edge > -0.6) {
          const th = Math.atan2(y, -(x + 22));
          const ray = Math.pow(0.5 + 0.5 * Math.cos(th * 26), 6);
          const fold = 0.5 + 0.5 * Math.sin(th * 9 + grain(x * 0.2, 3) * 4);
          const a = clamp01((edge + 0.6) / 1.4) * (lerp(0.8, 0.34, clamp01((-27 - x) / 26)) + ray * 0.16 - fold * 0.1);
          let f0 = finC[0], f1 = finC[1], f2 = finC[2];
          const rootMix = clamp01(1 - (-26 - x) / 7);
          if (pedHi) {
            f0 = lerp(f0, lerp(base[0], spotC[0], rootMix * 0.8), rootMix);
            f1 = lerp(f1, lerp(base[1], spotC[1], rootMix * 0.8), rootMix);
            f2 = lerp(f2, lerp(base[2], spotC[2], rootMix * 0.8), rootMix);
          } else if (pedSumi) {
            f0 = lerp(f0, sumiC[0], rootMix * 0.7);
            f1 = lerp(f1, sumiC[1], rootMix * 0.7);
            f2 = lerp(f2, sumiC[2], rootMix * 0.7);
          }
          const lift = ray * 22;
          finA[i] = clamp01(a);
          finRGB[i * 3] = Math.min(255, f0 + lift);
          finRGB[i * 3 + 1] = Math.min(255, f1 + lift);
          finRGB[i * 3 + 2] = Math.min(255, f2 + lift);
        }
      }
    }
  }

  // ---- 合成 ----
  const [c, ctx] = canvasOf(W, H);
  const img = ctx.createImageData(W, H);
  const o = img.data;
  for (let i = 0, j = 0, r = 0; i < N; i++, j += 4, r += 3) {
    const ba = alpha[i], fa = finA[i];
    const a = ba + fa * (1 - ba);
    if (a <= 0) continue;
    const sh = shade[i], sp = spec[i] * 255;
    const br = Math.min(255, alb[r] * sh + sp);
    const bg = Math.min(255, alb[r + 1] * sh + sp);
    const bb = Math.min(255, alb[r + 2] * sh + sp * 0.96);
    const fk = fa * (1 - ba);
    o[j] = (br * ba + finRGB[r] * fk) / a;
    o[j + 1] = (bg * ba + finRGB[r + 1] * fk) / a;
    o[j + 2] = (bb * ba + finRGB[r + 2] * fk) / a;
    o[j + 3] = a * 255;
  }
  ctx.putImageData(img, 0, 0);

  // ---- 矢量细节：头部光泽、鳃盖、鼻孔、须、眼 ----
  ctx.save();
  ctx.scale(ppu, ppu);
  ctx.translate(-KOI_BODY.spriteLeft, KOI_BODY.spriteHalf);
  ctx.globalCompositeOperation = 'source-atop';
  const gloss = ctx.createRadialGradient(27, 0, 0, 27, 0, 7);
  gloss.addColorStop(0, 'rgba(255,255,250,0.16)');
  gloss.addColorStop(1, 'rgba(255,255,250,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(18, -9, 18, 18);
  ctx.lineCap = 'round';
  const ink = kind === 'sumi' ? 'rgba(200,210,205,' : 'rgba(40,52,46,';
  for (const s of [-1, 1]) {
    const w1 = bodyHalfWidth(18.6, girth), w2 = bodyHalfWidth(16.2, girth);
    ctx.beginPath();
    ctx.moveTo(18.8, s * w1 * 0.42);
    ctx.quadraticCurveTo(18.2, s * w1 * 0.85, 16.2, s * w2 * 0.99);
    ctx.strokeStyle = ink + '0.16)';
    ctx.lineWidth = 0.55;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(30.6, s * 2.1, 0.55, 0.4, 0, 0, TAU);
    ctx.fillStyle = ink + '0.34)';
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(32.6, s * 1.9);
    ctx.quadraticCurveTo(34, s * 2.3, 34.7, s * 3.5);
    ctx.strokeStyle = kind === 'sumi' ? 'rgba(60,70,66,0.55)' : 'rgba(214,196,168,0.55)';
    ctx.lineWidth = 0.38;
    ctx.stroke();
    const ex = 25.8, ey = s * (bodyHalfWidth(ex, girth) - 1.25);
    const ring = ctx.createRadialGradient(ex, ey, 0.15, ex, ey, 1.45);
    ring.addColorStop(0, '#0f1413');
    ring.addColorStop(0.5, '#1a201e');
    ring.addColorStop(0.62, kind === 'ogon' ? '#d9bf78' : kind === 'sumi' ? '#6d7262' : '#b8aa7e');
    ring.addColorStop(0.85, 'rgba(120,110,90,0.35)');
    ring.addColorStop(1, 'rgba(120,110,90,0)');
    ctx.beginPath();
    ctx.arc(ex, ey, 1.45, 0, TAU);
    ctx.fillStyle = ring;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + 0.3, ey - 0.22, 0.26, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
  }
  ctx.restore();
  return c;
}

// ---------------- 胸鳍贴图 ----------------

function paintFin(pal: KoiPalette, ppu: number): { canvas: HTMLCanvasElement; px: number; py: number } {
  const [c, ctx] = canvasOf(21 * ppu, 14 * ppu);
  ctx.scale(ppu, ppu);
  ctx.translate(1, 7);
  const [fr, fg, fb] = hexRgb(pal.fin);
  const path = new Path2D();
  path.moveTo(0, -1.7);
  path.bezierCurveTo(5, -4, 12, -6.3, 15.8, -4.3);
  path.bezierCurveTo(18.2, -2.4, 18, 3, 15.2, 4.7);
  path.bezierCurveTo(10.6, 6.6, 4.6, 4.4, 0, 1.7);
  path.closePath();
  const g = ctx.createLinearGradient(0, 0, 18, 0);
  g.addColorStop(0, `rgba(${fr},${fg},${fb},0.95)`);
  g.addColorStop(0.6, `rgba(${fr},${fg},${fb},0.68)`);
  g.addColorStop(1, `rgba(${fr},${fg},${fb},0.42)`);
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 11; k++) {
    const a = -0.5 + k * 0.1 + 0.05;
    ctx.beginPath();
    ctx.moveTo(0.5, 0);
    ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let k = 0; k < 12; k++) {
    const a = -0.5 + k * 0.1;
    ctx.beginPath();
    ctx.moveTo(0.5, 0);
    ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.28;
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 0.35;
  ctx.stroke(path);
  return { canvas: c, px: 1 / 21, py: 0.5 };
}
