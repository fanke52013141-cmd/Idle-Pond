import { KOI_BODY, SEG_UNITS } from '../core/body';
import type { KoiSprites } from '../art/koi';

/** 沿脊柱把贴图逐段切条、旋转拼接（场景层与覆盖层共用） */
export function drawStrip(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, pose: Float32Array, s: number, cx: number, cy: number, k: number): void {
  const n = KOI_BODY.segments;
  const ppu = img.width / (KOI_BODY.nose - KOI_BODY.spriteLeft + 2);
  const hh = KOI_BODY.spriteHalf * s * k;
  for (let i = 0; i < n; i++) {
    const ax = cx + (pose[i * 4] - cx) * k, ay = cy + (pose[i * 4 + 1] - cy) * k;
    const bx = cx + (pose[i * 4 + 4] - cx) * k, by = cy + (pose[i * 4 + 5] - cy) * k;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.01) continue;
    const sx = KOI_BODY.nose - (i + 1) * SEG_UNITS - KOI_BODY.spriteLeft;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(Math.atan2(ay - by, ax - bx));
    if (i === 0) {
      ctx.drawImage(img, sx * ppu, 0, (SEG_UNITS + 2) * ppu, img.height, 0, -hh, len + 2 * s * k + 0.6, hh * 2);
    } else {
      ctx.drawImage(img, sx * ppu, 0, SEG_UNITS * ppu + 1, img.height, 0, -hh, len + 1, hh * 2);
    }
    if (i === n - 1) {
      ctx.drawImage(img, 0, 0, 2 * ppu, img.height, -2 * s * k, -hh, 2 * s * k + 0.4, hh * 2);
    }
    ctx.restore();
  }
}

export function drawFin(ctx: CanvasRenderingContext2D, sp: KoiSprites, x: number, y: number, ang: number, fs: number, side: number): void {
  const inv = 1 / sp.ppu;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(fs * inv, side * fs * inv);
  ctx.drawImage(sp.fin, -sp.finPx * sp.fin.width, -sp.finPy * sp.fin.height);
  ctx.restore();
}
