import { flowNormalTexture, noiseTexture, program, VS_QUAD, type GL } from './common';
import type { Look } from '../../core/looks';

/**
 * 水面合成 pass（全屏）：
 * 折射（涟漪法线 + 微风波 → 偏移采样场景）+ 焦散（高度场拉普拉斯聚焦，内联合并实现）
 * + 太阳/月亮镜面波光 + 月影 + 暗角。场景纹理按 FLIP_Y 上传，v=0 为屏幕底。
 */
export class WaterPass {
  private prog: WebGLProgram;
  private noise: WebGLTexture;
  private flow: WebGLTexture;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  constructor(private g: GL) {
    const gl = g.gl;
    this.prog = program(gl, VS_QUAD, `#version 300 es
      precision highp float;
      uniform sampler2D uScene, uRipple, uNoise, uFlow;
      uniform vec2 uView, uMoonPos, uFlowDir;
      uniform float uTime, uAspect, uRefract, uWaveAmp, uSpecK, uCausticK, uBright, uNightK, uNormC, uNormS;
      uniform vec3 uTint, uCausticTint, uSunColor;
      uniform vec2 uSunDir;
      in vec2 vUv; out vec4 o;
      void main(){
        vec2 uv = gl_FragCoord.xy / uView;

        // 自然水纹：细碎频谱法线图双层采样（1.9 / 4.3 两种尺度），滚动受风偏置。
        // 没有看得见的"波带"，只有有机的细碎闪动——这才是自然水面的质感
        vec2 cuv = uv * vec2(uAspect, 1.0);
        vec2 f1 = texture(uFlow, cuv * 1.9 + uFlowDir * uTime * 0.014).rg - 0.5;
        vec2 f2 = texture(uFlow, cuv * 4.3 - uFlowDir * uTime * 0.010).rg - 0.5;
        float mod_ = texture(uNoise, cuv * 2.2 + uTime * 0.008).r;
        vec2 baseN = (f1 * 1.15 + f2 * 0.6) * uWaveAmp * (0.6 + 0.8 * mod_);

        // 涟漪法线（ba 通道；按模拟纹理的编码方式解码）
        vec4 rip = texture(uRipple, uv);
        vec2 ripN = (rip.ba - uNormC) * uNormS;
        vec2 grad = ripN * 0.9 + baseN;

        // 折射：按法线偏移采样水下场景
        vec2 ruv = uv + grad * uRefract / uView;
        ruv = clamp(ruv, vec2(0.001), vec2(0.999));
        vec3 scene = texture(uScene, ruv).rgb;

        // 焦散：涟漪法线的散度（会聚处增亮）+ 缓慢移动的细密基底光网
        vec2 dpx = 1.5 / uView;
        vec2 cc = vec2(uNormC);
        vec2 nl = texture(uRipple, uv - vec2(dpx.x, 0.0)).ba;
        vec2 nr = texture(uRipple, uv + vec2(dpx.x, 0.0)).ba;
        vec2 nd = texture(uRipple, uv - vec2(0.0, dpx.y)).ba;
        vec2 nu = texture(uRipple, uv + vec2(0.0, dpx.y)).ba;
        vec2 gx = (nr - nl) / uNormS;
        vec2 gy = (nu - nd) / uNormS;
        float divN = gx.x + gy.y;
        float focus = clamp(-divN * 5.0, 0.0, 0.9);
        float base = texture(uNoise, cuv * 3.2 + uTime * vec2(0.02, 0.013)).b;
        float fine = texture(uNoise, cuv * 11.0 - uTime * vec2(0.014, 0.021)).g;
        float web = base * 0.62 + fine * 0.38;
        float baseCaust = pow(clamp(web * 1.6 - 0.68, 0.0, 1.0), 2.0) * 0.4;
        float caust = max(focus, baseCaust) * uCausticK;
        scene += caust * uCausticTint;

        // 波光：朝向太阳的镜面 + 碎金星点（高频噪声阈值化，随波面朝向出现/消失）
        vec3 N = normalize(vec3(grad, 1.0));
        vec3 L = normalize(vec3(uSunDir * 0.38, 1.0));
        float facing = max(dot(N, L), 0.0);
        float g1 = texture(uNoise, cuv * 9.0 + uTime * vec2(0.05, 0.03)).g;
        float g2 = texture(uNoise, cuv * 15.0 - uTime * vec2(0.04, 0.06)).r;
        float sparkle = pow(clamp(g1 * g2 * 3.1 - 1.35, 0.0, 1.0), 2.0);
        float spec = (pow(facing, 130.0) * 0.75 + sparkle * 0.9 * pow(facing, 3.0)) * uSpecK;
        vec3 c = scene + spec * uSunColor;

        // 月影：柔和光晕 + 亮盘
        float md = distance(uv * vec2(uAspect, 1.0), uMoonPos * vec2(uAspect, 1.0));
        c += exp(-md * md * 26.0) * uNightK * vec3(0.16, 0.19, 0.24);
        c += exp(-md * md * 900.0) * uNightK * vec3(0.55, 0.6, 0.66);

        // 暗角与输出
        vec2 vg = uv - 0.5;
        c *= 1.0 - dot(vg, vg) * 0.42;
        c *= uBright;
        o = vec4(c * uTint, 1.0);
      }`);
    this.noise = noiseTexture(gl);
    this.flow = flowNormalTexture(gl);
    for (const u of ['uScene', 'uRipple', 'uNoise', 'uFlow', 'uView', 'uMoonPos', 'uFlowDir', 'uTime', 'uAspect', 'uRefract', 'uWaveAmp', 'uSpecK', 'uCausticK', 'uBright', 'uNightK', 'uNormC', 'uNormS', 'uTint', 'uCausticTint', 'uSunColor', 'uSunDir']) {
      this.uniforms[u] = gl.getUniformLocation(this.prog, u);
    }
  }

  render(p: {
    sceneTex: WebGLTexture;
    rippleTex: WebGLTexture;
    normEncoded: boolean;
    viewW: number; viewH: number;
    time: number; look: Look;
    wind?: { angle: number; k: number };
  }): void {
    const gl = this.g.gl;
    const u = this.uniforms;
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.g.quad);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, p.sceneTex);
    gl.uniform1i(u.uScene!, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, p.rippleTex);
    gl.uniform1i(u.uRipple!, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.noise);
    gl.uniform1i(u.uNoise!, 2);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.flow);
    gl.uniform1i(u.uFlow!, 3);
    // 流动方向：风的方向（uv 空间 y 向上，屏幕风 y 向下需翻转）；无风时默认东北向
    const wdir = p.wind ?? { angle: 2.2, k: 0.32 };
    const spd = 0.35 + wdir.k * 0.85;
    gl.uniform2f(u.uFlowDir!, Math.cos(wdir.angle) * spd, -Math.sin(wdir.angle) * spd);
    gl.uniform2f(u.uView!, p.viewW, p.viewH);
    const sun = p.look.sun;
    // 太阳（昼）或月亮（夜）的屏幕方向：北=-y 东=+x
    const az = sun.nightK > 0.5 ? sun.azimuth + Math.PI : sun.azimuth;
    gl.uniform2f(u.uSunDir!, Math.sin(az), -Math.cos(az));
    gl.uniform2f(u.uMoonPos!, 0.76, 1 - 0.2);
    gl.uniform1f(u.uTime!, p.time);
    gl.uniform1f(u.uAspect!, p.viewW / p.viewH);
    gl.uniform1f(u.uRefract!, p.look.refract);
    gl.uniform1f(u.uWaveAmp!, p.look.waveAmp);
    gl.uniform1f(u.uSpecK!, p.look.specK);
    gl.uniform1f(u.uCausticK!, p.look.causticK);
    gl.uniform1f(u.uBright!, p.look.bright);
    gl.uniform1f(u.uNightK!, sun.nightK);
    gl.uniform1f(u.uNormC!, p.normEncoded ? 0.5 : 0);
    gl.uniform1f(u.uNormS!, p.normEncoded ? 2 : 1);
    gl.uniform3f(u.uTint!, p.look.tint[0], p.look.tint[1], p.look.tint[2]);
    gl.uniform3f(u.uCausticTint!, p.look.causticTint[0], p.look.causticTint[1], p.look.causticTint[2]);
    const sc = sun.color;
    gl.uniform3f(u.uSunColor!, sc[0], sc[1], sc[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
