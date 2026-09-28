import { program, target, VS_QUAD, type GL, type Target } from './common';

/**
 * 高度场涟漪模拟（借鉴 evanw/webgl-water 的算法，WebGL2 重写）：
 * 纹理 RG 存 (高度 h, 速度 v)，BA 存法线 xz。
 * sim: v += (邻均值 - h)*k; v *= 阻尼; h += v —— 波动方程的 Jacobi 迭代
 * normal: 高度场有限差分 → 表面法线
 * 首选 RGBA16F；无 EXT_color_buffer_float 时用 RGBA8 编码（h/v 以 0.5 为零点）
 */
export class RippleSim {
  private progDrop: WebGLProgram;
  private progSim: WebGLProgram;
  private progNormal: WebGLProgram;
  private a: Target;
  private b: Target;
  private cur = 0;
  readonly w: number;
  readonly h: number;
  readonly floatOk: boolean;
  aspect: number; // 宽/高，用于圆形水滴

  constructor(private g: GL, w: number, h: number) {
    const gl = g.gl;
    this.w = w;
    this.h = h;
    this.aspect = w / h;
    this.floatOk = !!gl.getExtension('EXT_color_buffer_float');

    const enc = this.floatOk ? '' : `
      float dec(float x){ return x*2.0-1.0; }
      float enc2(float x){ return clamp(x*0.5+0.5, 0.0, 1.0); }
    `;
    // 读用原始通道，写必须落到"计算后的局部变量"（h/v/n）——曾因写成 t.r/t.g 导致模拟从未运行
    const readH = this.floatOk ? 't.r' : 'dec(t.r)';
    const writeH = this.floatOk ? 'h' : 'enc2(h)';
    const readV = this.floatOk ? 't.g' : 'dec(t.g)';
    const writeV = this.floatOk ? 'v' : 'enc2(v)';
    const baOut = this.floatOk ? 'n.x, n.z' : 'enc2(n.x), enc2(n.z)';

    this.progDrop = program(gl, VS_QUAD, `#version 300 es
      precision highp float;
      uniform sampler2D uTex; uniform vec2 uCenter; uniform float uRadius; uniform float uStrength; uniform float uAspect;
      in vec2 vUv; out vec4 o;
      ${enc}
      void main(){
        vec4 t = texture(uTex, vUv);
        vec2 d = (vUv - uCenter) * vec2(uAspect, 1.0);
        float h = ${readH};
        h += uStrength * exp(-dot(d,d)/(uRadius*uRadius));
        o = vec4(${writeH}, t.g, t.ba);
      }`);

    this.progSim = program(gl, VS_QUAD, `#version 300 es
      precision highp float;
      uniform sampler2D uTex; uniform vec2 uDelta;
      in vec2 vUv; out vec4 o;
      ${enc}
      void main(){
        vec4 t = texture(uTex, vUv);
        vec2 dx = vec2(uDelta.x, 0.0), dy = vec2(0.0, uDelta.y);
        float h = ${readH};
        float avg = (${readH.replace('t.r', 'texture(uTex, vUv-dx).r')} + ${readH.replace('t.r', 'texture(uTex, vUv+dx).r')}
                   + ${readH.replace('t.r', 'texture(uTex, vUv-dy).r')} + ${readH.replace('t.r', 'texture(uTex, vUv+dy).r')}) * 0.25;
        float v = ${readV};
        v += (avg - h) * 2.0;
        v *= 0.995;
        h += v;
        o = vec4(${writeH}, ${writeV}, t.ba);
      }`);

    this.progNormal = program(gl, VS_QUAD, `#version 300 es
      precision highp float;
      uniform sampler2D uTex; uniform vec2 uDelta; uniform float uSlope;
      in vec2 vUv; out vec4 o;
      ${enc}
      void main(){
        vec4 t = texture(uTex, vUv);
        float h = ${readH};
        float hx = ${readH.replace('t.r', 'texture(uTex, vUv+vec2(uDelta.x,0.0)).r')};
        float hy = ${readH.replace('t.r', 'texture(uTex, vUv+vec2(0.0,uDelta.y)).r')};
        // uSlope：斜率增益。高度差相对 UV 步长的量级只有 ~1e-2，不放大则折射位移 <0.5px 不可见
        vec3 dx = vec3(uDelta.x, (hx - h) * uSlope, 0.0);
        vec3 dy = vec3(0.0, (hy - h) * uSlope, uDelta.y);
        vec3 n = normalize(cross(dy, dx));
        o = vec4(t.r, t.g, ${baOut});
      }`);

    const a = target(gl, w, h, this.floatOk);
    const b = target(gl, w, h, this.floatOk);
    if (!a || !b) throw new Error('ripple fbo failed');
    this.a = a;
    this.b = b;
    this.clear();
  }

  private clear(): void {
    const gl = this.g.gl;
    for (const t of [this.a, this.b]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      // float 模式零点是 0；RGBA8 编码的零点是 0.5
      if (this.floatOk) gl.clearColor(0, 0, 0, 0);
      else gl.clearColor(0.5, 0.5, 0.5, 0.5);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** uv 为纹理空间（v=0 底部）；radius/strength 同空间 */
  drop(xUv: number, yUv: number, radius: number, strength: number): void {
    const gl = this.g.gl;
    gl.useProgram(this.progDrop);
    this.bindRead(0);
    gl.uniform1i(gl.getUniformLocation(this.progDrop, 'uTex'), 0);
    gl.uniform2f(gl.getUniformLocation(this.progDrop, 'uCenter'), xUv, yUv);
    gl.uniform1f(gl.getUniformLocation(this.progDrop, 'uRadius'), radius);
    gl.uniform1f(gl.getUniformLocation(this.progDrop, 'uStrength'), strength);
    gl.uniform1f(gl.getUniformLocation(this.progDrop, 'uAspect'), this.aspect);
    this.drawToAndSwap();
  }

  /** 斜率增益：控制涟漪法线 → 折射位移的可见强度 */
  slope = 22;

  step(n = 2): void {    const gl = this.g.gl;
    for (let i = 0; i < n; i++) {
      gl.useProgram(this.progSim);
      this.bindRead(0);
      gl.uniform1i(gl.getUniformLocation(this.progSim, 'uTex'), 0);
      gl.uniform2f(gl.getUniformLocation(this.progSim, 'uDelta'), 1 / this.w, 1 / this.h);
      this.drawToAndSwap();
    }
    gl.useProgram(this.progNormal);
    this.bindRead(0);
    gl.uniform1i(gl.getUniformLocation(this.progNormal, 'uTex'), 0);
    gl.uniform2f(gl.getUniformLocation(this.progNormal, 'uDelta'), 1 / this.w, 1 / this.h);
    gl.uniform1f(gl.getUniformLocation(this.progNormal, 'uSlope'), this.slope);
    this.drawToAndSwap();
  }

  get texture(): WebGLTexture {
    return (this.cur === 0 ? this.a : this.b).tex;
  }

  private bindRead(unit: number): void {
    const gl = this.g.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, (this.cur === 0 ? this.a : this.b).tex);
  }

  private drawToAndSwap(): void {
    const gl = this.g.gl;
    const dst = this.cur === 0 ? this.b : this.a;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
    gl.viewport(0, 0, this.w, this.h);
    gl.bindVertexArray(this.g.quad);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.cur = 1 - this.cur;
  }

  dispose(): void {
    const gl = this.g.gl;
    for (const t of [this.a, this.b]) {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fbo);
    }
  }
}
