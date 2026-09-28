import { clamp01, lerp } from './utils';

export interface SunState {
  elevation: number;               // 太阳高度角（弧度，夜间为负）
  azimuth: number;                 // 方位角（弧度，自正北顺时针）
  shadowDir: [number, number];     // 影子方向（屏幕坐标，单位化；y 向下）
  shadowLen: number;               // 影子相对长度 0.3..3（晨昏长、正午短）
  color: [number, number, number]; // 直射光色温
  intensity: number;               // 直射/焦散总强度 0..1
  nightK: number;                  // 夜晚系数 0..1
  moonPhase: number;               // 月相 0..1（0 新月 0.5 满月）
  mist: number;                    // 清晨薄雾 0..1
  dayHour: number;                 // 当地小时（小数，供花开等用）
}

const DEG = Math.PI / 180;

/** 月相：以 2000-01-06 新月为基准的会合周期 */
export function moonPhase(now: Date): number {
  const synodic = 29.530588853;
  const days = (now.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  const p = (days % synodic) / synodic;
  return p < 0 ? p + 1 : p;
}

/**
 * 简化太阳轨迹：赤纬 + 时角模型（忽略大气折射与均时差的精细项，
 * 做经度 4 分钟/度 的太阳时修正）。视觉连续即可，非天文级。
 */
export function sunState(now: Date, latDeg = 31.2, lonDeg = 121.4): SunState {
  const local = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const startOfYear = Date.UTC(now.getFullYear(), 0, 0);
  const dayN = Math.floor((now.getTime() - startOfYear) / 86400000);

  const decl = 23.44 * DEG * Math.sin((2 * Math.PI * (284 + dayN)) / 365);
  // 太阳时修正：每偏离东八区标准经线 1° 差 4 分钟
  const st = local + ((lonDeg - 120) * 4) / 60;
  const hourAngle = (st - 12) * 15 * DEG;

  const lat = latDeg * DEG;
  const sinEl = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl)));

  // 方位角（自北顺时针）：由高度角反解，象限由时角决定
  const cosAz = (Math.sin(decl) - sinEl * Math.sin(lat)) / (Math.max(1e-4, Math.cos(elevation)) * Math.cos(lat));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (hourAngle > 0) azimuth = 2 * Math.PI - azimuth; // 下午在西侧

  // 屏幕方向：北 = -y，东 = +x；影子背向太阳
  const sunX = Math.sin(azimuth);
  const sunY = -Math.cos(azimuth);
  const dayK = clamp01((sinEl + 0.06) * 6);
  const nightK = 1 - clamp01((sinEl + 0.1) * 8);

  // 影长：正午 ≈ 0.35，日出日落拉长到 3
  const shadowLen = elevation > 0.02 ? Math.min(3, Math.max(0.35, 1 / Math.tan(Math.max(0.03, elevation)))) : 3;

  // 色温：低角度暖金 → 高角度清白
  const warm = clamp01(1 - sinEl * 2.2);
  const color: [number, number, number] = [
    lerp(1, 1, warm),
    lerp(0.97, 0.62, warm),
    lerp(0.9, 0.34, warm),
  ];

  // 清晨薄雾：日出后 1.5 小时内高斯衰减
  const sunriseH = 12 - (Math.acos(Math.max(-1, Math.min(1, (-Math.tan(lat) * Math.tan(decl))))) * 12) / Math.PI;
  const mist = Math.exp(-((local - sunriseH - 0.8) ** 2) / 0.7) * 0.9;

  return {
    elevation,
    azimuth,
    shadowDir: [-sunX, -sunY],
    shadowLen,
    color,
    intensity: clamp01(sinEl * 1.5) * dayK,
    nightK,
    moonPhase: moonPhase(now),
    mist: sinEl > -0.05 ? mist : 0,
    dayHour: local,
  };
}

/** 夜间用月亮替代太阳方向（近似：太阳轨迹 +12 小时） */
export function moonDir(s: SunState): [number, number] {
  // 月亮方位近似：与太阳相对
  const az = s.azimuth + Math.PI;
  return [-Math.sin(az), Math.cos(az)];
}
