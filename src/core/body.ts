import { hash1 } from './rng';

/** 鱼体平面定义。局部坐标 +x 朝头；贴图是沿 x 切条用的静态皮肤 */
export interface BodyPlan {
  nose: number;
  tailTip: number;
  length: number;
  segments: number;
  rigidHead: number;
  spriteLeft: number;
  spriteHalf: number;
}

export const KOI_BODY: BodyPlan = {
  nose: 34,
  tailTip: -58,
  length: 92,
  segments: 16,
  rigidHead: 5,
  spriteLeft: -60,
  spriteHalf: 14,
};

/** 每节脊柱对应的体轴长度 */
export const SEG_UNITS = (KOI_BODY.nose - KOI_BODY.tailTip) / KOI_BODY.segments;
/** 贴图横向覆盖的体坐标宽度（含吻端与尾梢余量） */
export const SPRITE_WIDTH = KOI_BODY.nose - KOI_BODY.spriteLeft + 2;

/** 随种子的胖瘦（±7%） */
export const girthOf = (seed: number) => 0.93 + hash1(seed + 3) * 0.14;

/**
 * 俯视半宽剖面：圆钝的楔形头 → 在身长 42% 处（胸鳍与背鳍之间）最宽 → 收窄成尾柄。
 * 金鱼（fancy）：身形更圆更宽，最宽点更靠前。x 超出体轴范围时返回 0（尾鳍区域由此接管）。
 */
export function bodyHalfWidth(x: number, girth: number, kind: string = 'koi'): number {
  const nose = KOI_BODY.nose, tailRoot = -30;
  const t = (nose - x) / (nose - tailRoot);
  if (t < 0 || t > 1) return 0;
  const fancy = kind === 'goldfish';
  const peak = fancy ? 0.5 : 0.42;
  const W = (fancy ? 11.2 : 9.6) * girth;
  const cap = t > 0.93 ? Math.sqrt(Math.max(0, 1 - ((t - 0.93) / 0.07) ** 2)) : 1;
  if (t < peak) {
    const s = t / peak;
    return W * Math.pow(1 - (1 - s) * (1 - s), 0.55) * cap;
  }
  return W * (1 - (fancy ? 0.52 : 0.6) * Math.pow((t - peak) / (1 - peak), fancy ? 1.3 : 1.5)) * cap;
}
