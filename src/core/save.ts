import { sanitizeFish, type FishDataLike } from './fish';
import type { Pad, Plants } from './plants';

const KEY = 'moonlotus-save-v1';

export interface SaveData {
  v: 1;
  fish: FishDataLike[];
  pads: Omit<Pad, 'ox' | 'oy' | 'vx' | 'vy'>[];
  lotus: { nx: number; ny: number; variant: number; age: number; phase: 'bud' | 'bloom' | 'seedpod'; seed: number }[];
  settings: { quality: 'high' | 'eco'; water: 'sim' | 'lite' | 'off' };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    if (d.v !== 1 || !Array.isArray(d.fish) || !d.fish.length) return null;
    return {
      v: 1,
      fish: d.fish.slice(0, 60).map(sanitizeFish).filter((f): f is FishDataLike => f !== null),
      pads: Array.isArray(d.pads) ? d.pads.slice(0, 40).filter((p) => p && Number.isFinite(p.nx) && Number.isFinite(p.ny)) : [],
      lotus: Array.isArray(d.lotus) ? d.lotus.slice(0, 12).filter((l) => l && Number.isFinite(l.nx)) : [],
      settings: {
        quality: d.settings?.quality === 'eco' ? 'eco' : 'high',
        water: ['sim', 'lite', 'off'].includes(d.settings?.water) ? d.settings.water : 'sim',
      },
    };
  } catch {
    return null;
  }
}

export function writeSave(data: Omit<SaveData, 'v'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, v: 1 as const }));
  } catch {
    /* 隐私模式等场景静默失败 */
  }
}

/** 把存档应用到植物系统（空则返回 false，由调用方播种默认布局） */
export function applyPlantsSave(plants: Plants, data: SaveData | null): boolean {
  if (!data || (!data.pads.length && !data.lotus.length)) return false;
  if (data.pads.length) {
    plants.pads = data.pads.map((p) => ({ ...p, ox: 0, oy: 0, vx: 0, vy: 0 }));
  }
  if (data.lotus.length) {
    plants.lotus = data.lotus.map((l) => ({ ...l }));
  }
  return true;
}
