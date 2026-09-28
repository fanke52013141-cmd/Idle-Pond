import { clamp } from './utils';

/** 存档中的鱼数据（宽松形状，清洗后回填默认值） */
export interface FishDataLike {
  id?: string;
  name?: string;
  palette?: number;
  seed?: number;
  size?: number;
  x?: number;
  y?: number;
  angle?: number;
  speedMul?: number;
  meals?: number;
  bornAt?: number;
}

const PALETTE_COUNT = 7;

export function sanitizeFish(f: FishDataLike, index = 0): FishDataLike | null {
  if (!f || typeof f !== 'object') return null;
  let size = Number.isFinite(f.size) ? clamp(f.size!, 0.4, 1.5) : 0.8;
  // 旧档体型区间是 0.52~0.86，迁移到新区间 0.5~1.3（大小差异一眼可辨）
  if (size > 0.4 && size <= 0.9) size = clamp(0.5 + ((size - 0.52) / 0.34) * 0.8, 0.4, 1.5);
  return {
    id: typeof f.id === 'string' ? f.id.slice(0, 80) : `koi-restored-${index}`,
    name: typeof f.name === 'string' ? f.name.trim().slice(0, 12) || '锦鲤' : '锦鲤',
    palette: Number.isInteger(f.palette) ? clamp(f.palette!, 0, PALETTE_COUNT - 1) : index % PALETTE_COUNT,
    seed: Number.isFinite(f.seed) ? Math.floor(f.seed!) : (index * 7919 + 13) % 100000,
    size,
    x: Number.isFinite(f.x) ? clamp(f.x!, 0.03, 0.97) : 0.2 + (index % 5) * 0.15,
    y: Number.isFinite(f.y) ? clamp(f.y!, 0.035, 0.965) : 0.25 + (index % 3) * 0.2,
    angle: Number.isFinite(f.angle) ? f.angle! : Math.random() * Math.PI * 2,
    speedMul: Number.isFinite(f.speedMul) ? clamp(f.speedMul!, 0.5, 1.5) : 1,
    meals: Number.isFinite(f.meals) ? Math.max(0, Math.floor(f.meals!)) : 0,
    bornAt: Number.isFinite(f.bornAt) ? f.bornAt! : Date.now(),
  };
}
