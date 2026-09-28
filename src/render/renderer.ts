import { KOI_BODY } from '../core/body';
import type { Critters } from '../core/critters';
import type { JumpSystem } from '../core/jump';
import type { Look } from '../core/looks';
import type { MinnowSchool } from '../core/minnow';
import type { Plants } from '../core/plants';
import type { Pond } from '../core/pond';
import { Scene2D } from './scene2d';
import { renderOverlay } from './overlay';
import { Particles } from './particles';
import { createGL, type GL } from './gl/common';
import { RippleSim } from './gl/ripple';
import { WaterPass } from './gl/water';

export type WaterQuality = 'sim' | 'lite' | 'off';

export interface RenderArgs {
  pond: Pond;
  plants: Plants;
  school: MinnowSchool;
  critters: Critters;
  jumps: JumpSystem;
  look: Look;
  wind: { angle: number; k: number };
  dt: number;
  quality: WaterQuality;
}

/**
 * 总渲染器：
 * - GL 模式：离屏场景(2D) → 上传 → 涟漪模拟 → 水面合成 → 屏幕；覆盖层画水面之上的一切
 * - 2D 降级：场景直绘可见画布 + 夜色/涟漪圈（无 WebGL2 或上下文丢失时）
 * 可见画布由本类创建并挂到宿主容器（上下文丢失后可整体重建换路）。
 */
export class PondRenderer {
  mode: 'gl' | '2d' = '2d';
  particles = new Particles();
  private scene = new Scene2D();
  private sceneCanvas: HTMLCanvasElement;
  private host: HTMLElement;
  private waterCanvas!: HTMLCanvasElement;
  private airCanvas!: HTMLCanvasElement;
  private airCtx!: CanvasRenderingContext2D;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private glPack: { g: GL; ripple: RippleSim; water: WaterPass; sceneTex: WebGLTexture } | null = null;
  private w = 1; private h = 1; private dpr = 1;
  private time = 0;
  private windTimer = 0.4;
  private wakeTimers = new WeakMap<object, number>();
  private rings: { x: number; y: number; age: number; max: number }[] = [];
  bed: HTMLImageElement | null = null;
  bedRich: HTMLImageElement | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
    this.sceneCanvas = document.createElement('canvas');
    this.buildDom();
  }

  private buildDom(): void {
    this.host.innerHTML = '';
    this.waterCanvas = document.createElement('canvas');
    this.waterCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    this.airCanvas = document.createElement('canvas');
    this.airCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    this.host.appendChild(this.waterCanvas);
    this.host.appendChild(this.airCanvas);
    this.airCtx = this.airCanvas.getContext('2d')!;
  }

  setBed(bed: HTMLImageElement | null, rich: HTMLImageElement | null): void {
    this.bed = bed;
    this.bedRich = rich;
  }

  resize(w: number, h: number, dpr: number): void {
    if (w < 50 || h < 50) return; // 退化尺寸不重建，避免 0 大小画布
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.initGl();
    this.airCanvas.width = Math.round(w * dpr);
    this.airCanvas.height = Math.round(h * dpr);
  }

  private initGl(): void {
    this.glPack = null;
    this.mode = '2d';
    this.ctx2d = null;
    try {
      const pack = createGL(this.waterCanvas);
      if (!pack) return;
      const rw = Math.max(128, Math.round(this.w / 3));
      const rh = Math.max(128, Math.round(this.h / 3));
      const ripple = new RippleSim(pack, rw, rh);
      const water = new WaterPass(pack);
      // 场景层与输出同分辨率（DPR 封顶 2）——半分辨率再放大会把鱼和荷叶全部糊掉
      const dprCap = Math.min(this.dpr, 2);
      const sw = Math.min(2560, Math.max(2, Math.round(this.w * dprCap)));
      const sh = Math.min(1440, Math.max(2, Math.round(this.h * dprCap)));
      this.sceneCanvas.width = sw;
      this.sceneCanvas.height = sh;
      const gl = pack.gl;
      const sceneTex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.waterCanvas.width = sw;
      this.waterCanvas.height = sh;
      this.glPack = { g: pack, ripple, water, sceneTex };
      this.mode = 'gl';
    } catch (e) {
      console.warn('水面 GL 初始化失败，使用 2D 降级', e);
      this.mode = '2d';
      this.glPack = null;
    }
    if (this.mode === '2d') {
      this.ctx2d = this.waterCanvas.getContext('2d');
      this.waterCanvas.width = Math.round(this.w * Math.min(this.dpr, 1.5));
      this.waterCanvas.height = Math.round(this.h * Math.min(this.dpr, 1.5));
    }
  }

  /** 交互与事件注入的涟漪（CSS 坐标）：一窄一宽两滴叠加出自然水纹 */
  ripple(x: number, y: number, strength = 1): void {
    if (this.mode === 'gl' && this.glPack) {
      const r = this.glPack.ripple;
      const u = x / this.w;
      const v = 1 - y / this.h;
      const k = Math.min(2.5, Math.max(0.25, strength));
      r.drop(u, v, 0.022, 0.02 * k);
      r.drop(u, v, 0.055, 0.012 * k);
      return;
    }
    if (this.rings.length < 60) this.rings.push({ x, y, age: 0, max: 1 + Math.min(2, strength * 3) });
  }

  splash(x: number, y: number, power: number): void {
    this.particles.splash(x, y, power);
    if (this.mode === 'gl') {
      this.ripple(x, y, 1.2 + power);
      if (this.glPack) this.glPack.ripple.drop(x / this.w, 1 - y / this.h, 0.05, 0.035 * power);
    } else {
      this.ripple(x, y, 2);
    }
  }

  render(a: RenderArgs): void {
    const { pond, look, dt } = a;
    this.time += dt;

    // 风的痕迹：沿风向排布的小涟漪串，频率与强度随风增大
    const wk = a.wind ? a.wind.k : 0.32;
    const wax = Math.cos(a.wind.angle), way = Math.sin(a.wind.angle);
    this.windTimer -= dt * (0.5 + wk * 2.4);
    if (this.windTimer <= 0) {
      this.windTimer = 0.85 + Math.random() * 1.2;
      const cx = Math.random() * this.w, cy = Math.random() * this.h;
      const st = 0.006 + 0.018 * wk;
      this.ripple(cx, cy, st);
      this.ripple(cx + wax * 26, cy + way * 26, st * 0.8);
      this.ripple(cx + wax * 52, cy + way * 52, st * 0.6);
    }

    // 水花冲击荷叶（鱼跃/投食的落点旁，叶子被推得晃一下）
    for (const c of this.particles.crownsList) {
      if (c.age < 0.12) a.plants.splashImpulse(c.x, c.y, 90, c.s / 26);
    }

    // 鱼尾迹：贴近水面的快鱼持续推水
    const w = pond.width, h = pond.height;
    for (const f of pond.fish) {
      if (f.depth > 0.22 || f.spine === null || f.jump) continue;
      const L = KOI_BODY.length * f.size * pond.scale;
      const bl = f.v / L;
      if (bl < 0.45) continue;
      const t = (this.wakeTimers.get(f) ?? 0) - dt;
      if (t <= 0) {
        const s = f.size * pond.scale;
        this.ripple(f.x * w + Math.cos(f.angle) * KOI_BODY.nose * s, f.y * h + Math.sin(f.angle) * KOI_BODY.nose * s, 0.014 * (1 - f.depth / 0.22) * Math.min(2, bl));
        this.wakeTimers.set(f, 0.15);
      } else this.wakeTimers.set(f, t);
    }

    // 粒子推进：落水 → 涟漪
    this.particles.update(dt, a.plants, w, h, (x, y, p) => this.ripple(x, y, p * 1.6));

    if (this.mode === 'gl' && this.glPack) {
      const { g, ripple, water, sceneTex } = this.glPack;
      const gl = g.gl;
      const sceneCtx = this.sceneCanvas.getContext('2d')!;
      const q = this.sceneCanvas.width / Math.max(1, this.w);
      // 场景层在缩放坐标系里绘制（dpr 传 q），世界坐标仍是 CSS px
      this.scene.render(sceneCtx, this.w, this.h, q, { pond, plants: a.plants, school: a.school, critters: a.critters, look }, this.bed);
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.sceneCanvas);
      ripple.step(a.quality === 'lite' ? 1 : 2);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.waterCanvas.width, this.waterCanvas.height);
      water.render({
        sceneTex,
        rippleTex: ripple.texture,
        normEncoded: !ripple.floatOk,
        viewW: this.waterCanvas.width,
        viewH: this.waterCanvas.height,
        time: this.time,
        look,
        wind: a.wind,
      });
    } else {
      // 2D 降级：M0 画质直绘
      const ctx = this.ctx2d;
      if (!ctx) return;
      const dpr = Math.min(this.dpr, 1.5);
      this.scene.render(ctx, this.w, this.h, dpr, { pond, plants: a.plants, school: a.school, critters: a.critters, look }, this.bedRich ?? this.bed);
      const nk = look.sun.nightK;
      if (nk > 0) this.drawNightFallback(ctx, this.w, this.h, dpr, look);
      for (const r of this.rings) {
        r.age += dt;
        const f = Math.max(0, 1 - r.age / r.max);
        ctx.strokeStyle = `rgba(244,250,228,${(f * 0.5).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, 4 + r.age * 70, (4 + r.age * 70) * 0.92, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = this.rings.length - 1; i >= 0; i--) if (this.rings[i].age > this.rings[i].max) this.rings.splice(i, 1);
    }

    // 覆盖层（两种模式共用）
    renderOverlay(this.airCtx, this.w, this.h, Math.min(this.dpr, 2), { pond, plants: a.plants, look }, a.critters, this.particles, a.jumps, dt);
  }

  private drawNightFallback(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, look: Look): void {
    const nk = look.sun.nightK;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = `rgba(10,18,38,${(0.5 * nk).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
    const mx = w * 0.76, my = h * 0.2;
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, h * 0.26);
    g.addColorStop(0, `rgba(214,232,255,${(0.3 * nk).toFixed(3)})`);
    g.addColorStop(1, 'rgba(214,232,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const core = ctx.createRadialGradient(mx, my, 0, mx, my, 40);
    core.addColorStop(0, `rgba(240,246,254,${(0.75 * nk).toFixed(3)})`);
    core.addColorStop(0.55, `rgba(226,238,254,${(0.3 * nk).toFixed(3)})`);
    core.addColorStop(1, 'rgba(226,238,254,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(mx, my, 52, 34, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
