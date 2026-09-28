import type { SunState } from './sun';
import { clamp01, lerp } from './utils';

/** 一帧的全部观感参数：水面 shader、场景层、覆盖层共同消费 */
export interface Look {
  sun: SunState;
  bright: number;                   // 水体整体亮度
  tint: [number, number, number];   // 水色调
  causticK: number;                 // 焦散强度
  causticTint: [number, number, number];
  specK: number;                    // 波光强度
  waveAmp: number;                  // 微风波强度
  refract: number;                  // 折射偏移 px
  fireflyK: number;                 // 萤火虫系数
  elementBright: number;            // 覆盖层元素（荷叶等）的亮度
  elementTint: [number, number, number];
}

export function computeLook(sun: SunState, weather: 'sunny' | 'rain' = 'sunny', windK = 0.32): Look {
  const el = Math.max(0, Math.sin(sun.elevation));
  const night = sun.nightK;
  const golden = clamp01(1 - el * 2.2); // 黄金时刻系数

  const bright = lerp(1.04, 0.34, night) * lerp(1, 0.82, golden * 0.4);
  const tint: [number, number, number] = [
    lerp(1.02, 0.72, night) + golden * 0.05,
    lerp(1, 0.8, night),
    lerp(0.95, 1.1, night),
  ];
  const causticK = el * (1 - golden * 0.45) * (1 - night);
  const causticTint: [number, number, number] = [
    lerp(1, 0.75, night),
    lerp(0.98, 0.85, night),
    lerp(0.9, 1.05, night),
  ];
  const specK = el * 1.35 * (1 - night) + 0.3;
  const waveAmp = 0.16 + 0.22 * windK + 0.05 * night + (weather === "rain" ? 0.12 : 0);

  return {
    sun,
    bright,
    tint,
    causticK,
    causticTint,
    specK,
    waveAmp,
    refract: 10 + golden * 3 + windK * 3,
    fireflyK: night,
    elementBright: lerp(1, 0.42, night) * lerp(1, 0.9, golden * 0.3),
    elementTint: [lerp(1, 0.8, night) + golden * 0.06, lerp(1, 0.82, night), lerp(0.97, 1.05, night)],
  };
}
