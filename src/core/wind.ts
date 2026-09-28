import { clamp01 } from './utils';

/**
 * 风场：方向 + 强度 + 阵风包络。
 * 一个全局实例驱动所有"被风吹"的东西：水面波幅与涟漪走向、荷叶漂移与摆动、
 * 荷花点头、浮萍漂移。强度用双正弦起伏近似自然风，阵风按随机间隔到来。
 */
export class Wind {
  angle = 2.2;              // 屏幕坐标风向（弧度，风吹向哪里）
  k = 0.35;                 // 0..1 综合强度
  gust = 0;                 // 0..1 阵风包络（叠加在 k 上）
  private t = Math.random() * 100;
  private nextGust = 8 + Math.random() * 10;
  private gustT = -1;

  update(dt: number): void {
    this.t += dt;
    // 基础风：慢速起伏
    const base = 0.34 + 0.16 * Math.sin(this.t * 0.11) + 0.09 * Math.sin(this.t * 0.27 + 2.1);
    // 阵风：随机间隔到来，2.8s 的正弦包络
    if (this.gustT < 0) {
      this.nextGust -= dt;
      if (this.nextGust <= 0) {
        this.gustT = 0;
        this.nextGust = 9 + Math.random() * 14;
      }
    } else {
      this.gustT += dt;
      const dur = 2.8;
      this.gust = Math.sin(Math.min(1, this.gustT / dur) * Math.PI) * 0.5;
      if (this.gustT >= dur) {
        this.gustT = -1;
        this.gust = 0;
      }
    }
    // 方向缓慢游移
    this.angle += Math.sin(this.t * 0.043) * 0.14 * dt;
    this.k = clamp01(base + this.gust);
  }
}
