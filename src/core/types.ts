export type KoiKind = 'kohaku' | 'sanke' | 'ogon' | 'utsuri' | 'tancho' | 'sumi' | 'beni' | 'goldfish';

export interface KoiPalette {
  name: string;
  base: string;
  spot: string;
  second?: string;
  fin: string;
  kind: KoiKind;
}

/** 花色定义：经典锦鲤品种，色值按整体冷调环境微调 */
export const PALETTES: KoiPalette[] = [
  { name: '红白', base: '#f6f1e3', spot: '#c94a2e', fin: '#f4f1e7', kind: 'kohaku' },
  { name: '三色', base: '#f4efe2', spot: '#c6472c', second: '#20282a', fin: '#f1eee4', kind: 'sanke' },
  { name: '黄金', base: '#d8a43c', spot: '#d29c33', fin: '#e3b659', kind: 'ogon' },
  { name: '白写', base: '#f0efe6', spot: '#232b2b', fin: '#eeece3', kind: 'utsuri' },
  { name: '丹顶', base: '#f7f4eb', spot: '#cc3e2a', fin: '#f3f2ea', kind: 'tancho' },
  { name: '墨鲤', base: '#2c3332', spot: '#181e1f', fin: '#47504d', kind: 'sumi' },
  { name: '绯鲤', base: '#c73326', spot: '#c73326', fin: '#c93a2e', kind: 'beni' },
  { name: '金鱼红', base: '#d9542a', spot: '#d9542a', fin: '#f2a05a', kind: 'goldfish' },
  { name: '五花', base: '#e9e1d1', spot: '#d86a2e', second: '#3a4a52', fin: '#f0c890', kind: 'goldfish' },
];

/** 持久化的鱼数据（存档只保留这一层） */
export interface FishData {
  id: string;
  name: string;
  palette: number;
  seed: number;
  size: number;
  x: number;
  y: number;
  angle: number;
  speedMul: number;
  meals: number;
  bornAt: number;
}

/** 运行时状态，从不入存档 */
export interface Fish extends FishData {
  v: number;
  turn: number;
  thrust: number;
  beating: boolean;
  amp: number;
  phase: number;
  depth: number;
  depthGoal: number;
  goal: { x: number; y: number } | null;
  goalTime: number;
  rest: number;
  flee: number;
  fleeAngle: number;
  cruise: number;
  react: number;
  appetite: number;
  spine: Float32Array | null;
  spineScale: number;
  jump: { t: number; dur: number; dirX: number; dirY: number; power: number } | null;
  dashT: number;
  dashCd: number;
}

export interface FoodPellet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  drift: number;
  eaten: boolean;
}

export type PondEvent = { type: 'eat'; x: number; y: number; fish: Fish };
