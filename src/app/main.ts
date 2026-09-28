import { JumpSystem } from '../core/jump';
import { computeLook } from '../core/looks';
import { MinnowSchool } from '../core/minnow';
import { Plants } from '../core/plants';
import { Pond, makeFish } from '../core/pond';
import { applyPlantsSave, loadSave, writeSave } from '../core/save';
import { sunState } from '../core/sun';
import { Wind } from '../core/wind';
import type { FishDataLike } from '../core/fish';
import { Critters } from '../core/critters';
import { PondRenderer, type WaterQuality } from '../render/renderer';

// ---- 宿主 ----
const host = document.getElementById('pond') as HTMLElement;
const renderer = new PondRenderer(host);

// ---- 系统 ----
const pond = new Pond();
const plants = new Plants();
const school = new MinnowSchool(18);
const critters = new Critters();
const jumps = new JumpSystem();
const wind = new Wind();

// ---- 存档恢复 ----
const save = loadSave();
let quality: 'high' | 'eco' = save?.settings.quality ?? 'high';
let waterQ: WaterQuality = new URLSearchParams(location.search).get('gl') === '0' ? 'off' : save?.settings.water ?? 'sim';
let pointer: { x: number; y: number } | null = null;

if (save) {
  save.fish.forEach((fd, i) => pond.add(restoreFish(fd, i)));
  applyPlantsSave(plants, save);
} else {
  for (let i = 0; i < 7; i++) pond.add(makeFish(i));
}
if (!save) applyPlantsSave(plants, null);

function restoreFish(fd: FishDataLike, i: number) {
  const f = {
    id: fd.id ?? `koi-${i}`, name: fd.name ?? '锦鲤',
    palette: fd.palette ?? 0, seed: fd.seed ?? 1, size: fd.size ?? 0.8,
    x: fd.x ?? 0.3, y: fd.y ?? 0.3, angle: fd.angle ?? 0, speedMul: fd.speedMul ?? 1,
    meals: fd.meals ?? 0, bornAt: fd.bornAt ?? Date.now(),
  };
  return f;
}

// ---- 时间（?t=HH:MM 伪造时刻，用于验收晨昏夜） ----
const timeParam = new URLSearchParams(location.search).get('t');
function nowDate(): Date {
  if (!timeParam) return new Date();
  const [hh, mm] = timeParam.split(':').map(Number);
  const d = new Date();
  d.setHours(hh || 0, mm || 0, 0, 0);
  return d;
}

// ---- 布局 ----
function layout(): void {
  const w = window.innerWidth, h = window.innerHeight;
  if (w < 50 || h < 50) return; // 宿主隐藏/最小化时可能报 0，等可见后再排
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(w, h, dpr);
  pond.layout(w, h);
}
layout();
window.addEventListener('resize', layout);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) layout();
});

// ---- 池底图：主图立即加载；丰富版仅降级档按需加载（省默认流量） ----
const loading = document.getElementById('loading')!;
let ready = false;
let richLoading = false;
function ensureRich(): void {
  if (richLoading || renderer.mode !== '2d') return;
  richLoading = true;
  const img = new Image();
  img.onload = () => { renderer.bedRich = img; };
  img.src = './assets/pond-rich.jpg';
}
{
  const img = new Image();
  img.onload = () => {
    renderer.bed = img;
    ready = true;
    loading.style.opacity = '0';
    setTimeout(() => loading.remove(), 700);
  };
  img.onerror = () => {
    ready = true;
    loading.style.opacity = '0';
    setTimeout(() => loading.remove(), 700);
  };
  img.src = './assets/pond.jpg';
}
ensureRich();
setTimeout(() => { if (!ready) { loading.style.opacity = '0'; setTimeout(() => loading.remove(), 700); } }, 4000);

// ---- 交互 ----
let lastTrail: { x: number; y: number } | null = null;
window.addEventListener('pointermove', (e) => {
  pointer = { x: e.clientX, y: e.clientY };
  if (!lastTrail || Math.hypot(e.clientX - lastTrail.x, e.clientY - lastTrail.y) > 52) {
    lastTrail = { x: e.clientX, y: e.clientY };
    renderer.ripple(e.clientX, e.clientY, 0.3);
  }
});
window.addEventListener('pointerdown', (e) => {
  if (pond.feed(e.clientX, e.clientY)) {
    renderer.splash(e.clientX, e.clientY, 0.55);
  } else {
    renderer.ripple(e.clientX, e.clientY, 1);
  }
});
window.addEventListener('dblclick', (e) => {
  pond.scare(e.clientX, e.clientY);
  renderer.ripple(e.clientX, e.clientY, 2);
});

// ---- 按钮 ----
const btnAdd = document.getElementById('btn-add')!;
const btnWater = document.getElementById('btn-water')!;
const btnEco = document.getElementById('btn-eco')!;

btnAdd.addEventListener('click', () => {
  if (pond.fish.length >= 14) return;
  pond.add(makeFish(pond.fish.length));
});

const WATER_LABEL: Record<WaterQuality, string> = { sim: '水面 · 模拟', lite: '水面 · 简化', off: '水面 · 关闭' };
btnWater.textContent = WATER_LABEL[waterQ];
btnWater.addEventListener('click', () => {
  waterQ = waterQ === 'sim' ? 'lite' : waterQ === 'lite' ? 'off' : 'sim';
  btnWater.textContent = WATER_LABEL[waterQ];
  layout(); // 触发渲染器按新模式重建
  ensureRich();
});

btnEco.textContent = quality === 'eco' ? '性能 · 省电' : '性能 · 流畅';
btnEco.addEventListener('click', () => {
  quality = quality === 'eco' ? 'high' : 'eco';
  btnEco.textContent = quality === 'eco' ? '性能 · 省电' : '性能 · 流畅';
});

// ---- 昼夜：太阳轨迹驱动（真实时钟；?t=HH:MM 可伪造时刻验收晨昏夜） ----
function look() {
  return computeLook(sunState(nowDate()), 'sunny', wind.k);
}

// ---- 调试句柄 ----
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as Record<string, unknown>).__pond = {
    pond, plants, school, critters, jumps, renderer, wind,
    forceRender(frames = 1, nightK?: number): void {
      for (let i = 0; i < frames; i++) {
        const lk = look();
        if (nightK !== undefined) lk.sun.nightK = nightK;
        stepAll(1 / 60);
        renderer.render({ pond, plants, school, critters, jumps, look: lk, wind, dt: 1 / 60, quality: waterQ });
      }
    },
  };
}

function stepAll(dt: number): void {
  pond.step(dt);
  wind.update(dt);
  plants.update(dt, look(), nowDate(), wind);
  school.update(dt, pond, pointer ? [pointer] : []);
  critters.update(dt, pond, pointer, (x, y, s) => renderer.ripple(x, y, s), wind);
  jumps.update(dt, pond, { onSplash: (x, y, p) => renderer.splash(x, y, p) });
  // 鱼跃状态标记：被接管的鱼暂停常规游泳
  if (jumps.active) jumps.active.fish.jump = { t: jumps.active.t, dur: jumps.active.dur, dirX: jumps.active.dirX, dirY: jumps.active.dirY, power: jumps.active.power };
}

// ---- 主循环：rAF 直驱 + dt 钳制（删除阈值节流——那是帧间隔抖动/不丝滑的来源）；eco=隔帧渲染 ----
const fpsEl = document.getElementById('fps')!;
let last = 0;
let frames = 0;
let fpsClock = 0;
let saveClock = 0;
let ecoSkip = false;

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
  last = now;
  if (document.hidden) return;
  if (quality === 'eco') {
    ecoSkip = !ecoSkip;
    if (ecoSkip) return;
  }

  stepAll(dt);
  renderer.render({ pond, plants, school, critters, jumps, look: look(), wind, dt, quality: waterQ });

  frames++;
  fpsClock += dt;
  saveClock += dt;
  if (fpsClock >= 1) {
    fpsEl.textContent = `${Math.round(frames / fpsClock)} fps · ${pond.fish.length} 尾 · ${renderer.mode === 'gl' ? '水面模拟' : '简化水面'}`;
    frames = 0;
    fpsClock = 0;
  }
  if (saveClock >= 10) {
    saveClock = 0;
    writeSave({
      fish: pond.fish.map((f) => ({ id: f.id, name: f.name, palette: f.palette, seed: f.seed, size: f.size, x: f.x, y: f.y, angle: f.angle, speedMul: f.speedMul, meals: f.meals, bornAt: f.bornAt })),
      pads: plants.pads.map(({ ox, oy, vx, vy, ...rest }) => rest),
      lotus: plants.lotus.map((l) => ({ ...l })),
      settings: { quality, water: waterQ },
    });
  }
}
requestAnimationFrame(frame);
