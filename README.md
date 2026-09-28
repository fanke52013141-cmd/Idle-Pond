# 荷塘月色 · Idle-Pond

> 桌面上的一方青瓷池塘。投喂锦鲤，看萤火与月色。

治愈系动态壁纸项目（M1 阶段）：WebGL2 高度场水面模拟、程序化锦鲤、AI 精灵荷叶荷花、
真实时钟太阳轨迹、风场、小鱼群/水黾/螺蛳/青虾生态。方案文档见 [`docs/方案.md`](docs/方案.md)。

## 运行

```bash
npm install
npm run dev        # 开发
npm run build      # 构建到 dist/（可整体丢给 Lively Wallpaper 挂载）
npm run preview    # 本地预览构建产物
npm run check      # TypeScript 类型检查
```

## 交互

- 轻点水面：投喂（鱼群会聚拢抢食）
- 双击：惊鱼（C 形逃散）
- 移动鼠标：掠起涟漪
- ＋锦鲤：往池塘里添一尾（上限 14，M0 临时值）
- 昼夜：自动（按本地时钟 19:30–21:00 入夜）/ 白天 / 月夜
- 性能：流畅 60fps / 省电 30fps；页面不可见时自动暂停

## 设为动态壁纸（Windows）

1. 安装 [Lively Wallpaper](https://www.rocksdanister.com/lively/)（开源免费）
2. `npm run build`，在 Lively 中添加网页壁纸，指向 `dist/index.html`
3. 建议开启 Lively 的「鼠标输入转发」以获得投喂交互

## 架构

```
src/
  core/    纯模拟：脊柱链、行为系统、鱼群（无 DOM 依赖，可单测）
  art/     程序化贴图：逐像素画鱼（肤色/斑纹/鳞片/明暗/高光四通道）
  render/  Canvas2D 渲染：影子三层模糊、深度雾、昼夜（WebGL2 路径 M1）
  app/     入口：交互、昼夜时钟、帧循环与节流
```

美术资产仅一张 AI 生成的池底图（生成记录见 `docs/ARTWORK.md`），一切生物皆代码。

## 致谢

灵感与算法思路（脊柱链游动、分层渲染、深度系统）来自开源项目
[碧池观鱼](https://github.com/moli-xia/fishwallpaper)（moli-xia/fishwallpaper），本项目的全部代码均为独立重写，
美术资产独立生成，未复制其任何代码与素材。
