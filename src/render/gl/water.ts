import { noiseTexture, program, VS_QUAD, type GL } from './common';
import type { Look } from '../../core/looks';

/**
 * 水面合成 pass（全屏）：
 * 折射（涟漪法线 + 微风波 → 偏移采样场景）+ 焦散（高度场拉普拉斯聚焦，内联合并实现）
 * + 太阳/月亮镜面波光 + 月影 + 暗角。场景纹理按 FLIP_Y 上传，v=0 为屏幕底。
 */
export class WaterPass {
  private prog: WebGLProgram;
  private noise: WebGLTexture;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};

  constructor(private g: GL) {
    const gl = g.gl;
    this.prog = program(gl, VS_QUAD, `#version 300 es
      precision highp float;
      uniform sampler2D uScene, uRipple, uNoise;
      uniform vec2 uView, uMoonPos;
      uniform float uTime, uAspect, uRefract, uWaveAmp, uSpecK, uCausticK, uBright, uNightK, uNormC, uNormS;
      uniform vec3 uTint, uCausticTint, uSunColor;
      uniform vec2 uSunDir;
      in vec2 vUv; out vec4 o;
      void main(){
        vec2 uv = gl_FragCoord.xy / uView;

        // 基线微波：两层反向滚动的平滑噪声 → 持续的细波法线（减 1.0 才是零点；减 2.0 会退化成整体平移）
        vec2 nuv = uv * vec2(uAspect, 1.0) * 3.1;
        vec3 w1 = texture(uNoise, nuv + uTime * vec2(0.021, 0.012)).rgb;
        vec3 w2 = texture(uNoise, nuv * 1.73 - uTime * vec2(0.016, 0.014)).rgb;
        vec2 baseN = (w1.rg + w2.rg - vec2(1.0)) * uWaveAmp;

        // 涟漪法线（ba 通道；按模拟纹理的编码方式解码）
        vec4 rip = texture(uRipple, uv);
        vec2 ripN = (rip.ba - uNormC) * uNormS;
        vec2 grad = ripN * 0.9 + baseN;

        // 折射：按法线偏移采样水下场景
        vec2 ruv = uv + grad * uRefract / uView;
        ruv = clamp(ruv, vec2(0.001), vec2(0.999));
        vec3 scene = texture(uScene, ruv).rgb;

        // 焦散：波峰（拉普拉斯为负处）聚光；叠加缓慢移动的细密基底光网
        vec2 dpx = 1.5 / uView;
        float h  = texture(uRipple, uv).r;
        float hl = texture(uRipple, uv - vec2(dpx.x, 0.0)).r;
        float hr = texture(uRipple, uv + vec2(dpx.x, 0.0)).r;
        float hd = texture(uRipple, uv - vec2(0.0, dpx.y)).r;
        float hu = texture(uRipple, uv + vec2(0.0, dpx.y)).r;
        float lap = (hl + hr + hd + hu) * 0.25 - h;
        float focus = clamp(-lap * 26.0, 0.0, 1.2);
        vec2 cuv = uv * vec2(uAspect, 1.0);
        float base = texture(uNoise, cuv * 2.0 + uTime * vec2(0.02, 0.013)).b;
        float fine = texture(uNoise, cuv * 7.0 - uTime * vec2(0.014, 0.021)).g;
        float web = base * 0.62 + fine * 0.38;
        float baseCaust = pow(clamp(web * 1.6 - 0.68, 0.0, 1.0), 2.0) * 0.4;
        float caust = max(focus, baseCaust) * uCausticK;
        scene += caust * uCausticTint;

        // 波光：太阳/月亮方向的镜面高光（较宽的瓣，密集闪烁的碎金感）
        vec3 N = normalize(vec3(grad, 1.0));
        vec3 L = normalize(vec3(uSunDir * 0.38, 1.0));
        float spec = pow(max(dot(N, L), 0.0), 130.0) * uSpecK;
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
    for (const u of ['uScene', 'uRipple', 'uNoise', 'uView', 'uMoonPos', 'uTime', 'uAspect', 'uRefract', 'uWaveAmp', 'uSpecK', 'uCausticK', 'uBright', 'uNightK', 'uNormC', 'uNormS', 'uTint', 'uCausticTint', 'uSunColor', 'uSunDir']) {
      this.uniforms[u] = gl.getUniformLocation(this.prog, u);
    }
  }

  render(p: {
    sceneTex: WebGLTexture;
    rippleTex: WebGLTexture;
    normEncoded: boolean;
    viewW: number; viewH: number;
    time: number; look: Look;
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
