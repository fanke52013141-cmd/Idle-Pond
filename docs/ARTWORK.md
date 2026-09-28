# 池塘美术来源

## 1. 丰富版池底（M0，降级档/简化档使用：`public/assets/pond-rich.jpg`）

- 工具：toapis `gpt-image-2-vip`（质量 low，比例 16:9，分辨率 2k）
- 输出：`public/assets/pond.jpg`（ffmpeg 压缩至 2048px 宽，JPEG q4，257KB）
- 原图备份：`docs/pond-src-2k.png`（3.7MB，不入运行时包）
- 用途：锦鲤池塘的静态水底、荷叶与荷花背景。鱼、鳍等一切生物由 `src/art/` 程序化绘制，无贴图素材。
- 未使用任何第三方素材或原项目（碧池观鱼）资产。

## 生成提示词（青瓷琉璃方向）

> Exquisite tranquil shallow garden pond seen from a perfectly vertical overhead orthographic view. Cool translucent celadon water like glazed porcelain, pale jade-green, soft glassy bands of light rippling across the sandy bottom. Fine pale sand and smooth blue-grey river stones visible underwater, delicate mottled mineral textures, a few scattered dark pebbles. Clusters of jade-green lotus leaves with dewy droplets hugging the left lower corner and right edge, one pale pink lotus blossom and one closed bud, two or three small floating fallen leaves. The center 70 percent is calm open water, gently lit, leaving room for animated fish to be added later. Quiet painterly game art, restrained porcelain-teal and sage palette, soft cool morning light, serene East Asian atmosphere. No fish, no animals, no people, no text, no UI, no borders, no horizon, no dry land, no perspective depth. Fill every pixel with pond.

## 任务记录

- task id: `tsk_img_01M3GTQJJ8ZF720VRCFA3TA463`
- 结果 URL: https://files.toapis.cn/generated/1790492550_5e69f5f1.png

## 2. 纯水底版（M1 主用：`public/assets/pond.jpg`）

- 工具：toapis `gpt-image-2-vip`（质量 low，比例 16:9，分辨率 1k）
- 与丰富版的差异：**无波纹、无光斑、无荷叶荷花**——水面的一切光影由 WebGL shader 实时生成，
  静态图只承担"水底材质"。原 657KB 图备份为 `pond-rich.jpg` 供"水面·关闭"档使用。
- 任务 id: `tsk_img_01M3GX4FHFDWVDFCX34X42K698`
- 结果 URL: https://files.toapis.cn/generated/1790495086_d0bcacb7.png

## 3. M1 现役资产（丰富池底 v3 + 透明底植物精灵）

- 丰富池底 v3（主用 `public/assets/pond.jpg`，柔和焦散光斑 + 苔藓卵石质感，479KB）
  - task id: `tsk_img_01M3H1R5Z2NN2Z5KV54PMX6TAA`
  - URL: https://files.toapis.cn/generated/1790499914_2a5bdf18.png
- 荷叶精灵 ×2（`public/assets/pad-a.png` / `pad-b.png`，透明底 rgba，带水珠）
  - pad-a: `tsk_img_01M3H1SCJQ5G841DGC5KQWSY2K` · https://files.toapis.cn/generated/1790499955_2ebb2f2e.png
  - pad-b: `tsk_img_01M3H1TKJVEBDAWRWNJKNR1M7H` · https://files.toapis.cn/generated/1790499994_f6275e8f.png
  - 提示词（荷叶）：A single round lotus leaf seen from directly above, perfectly top-down view, fresh jade green with slightly paler rim and subtle yellow-green edge, delicate radial veins, a few glistening water droplets on the surface, soft painterly game-art style with gentle volume shading, the leaf fills most of the frame, fully transparent background all around the leaf, no shadow, no water, no other objects, no text
- 荷花精灵（`public/assets/lotus.png`，透明底，盛放态；花苞/莲蓬仍程序化绘制）
  - task id: `tsk_img_01M3H1VM92MEW5AAG2VZVBK5A8`
  - URL: https://files.toapis.cn/generated/1790500024_d64e1ceb.png
  - 提示词（荷花）：A single fully open pink lotus flower seen from directly above, perfectly top-down view, delicate layered pale-pink petals with soft gradient to white at the base, small golden-yellow stamens in the center, soft painterly game-art style with subtle petal shading, the flower fills most of the frame, fully transparent background all around, no shadow, no leaf, no water, no text
- 全部经 toapis `gpt-image-2-vip`（质量 low）生成；荷花开合的"半开/花苞"精灵态计划在 M2 补齐。
- 提示词：

> Top-down orthographic view of the bottom of a shallow clear garden pond, flat sandy bed seen straight through perfectly still transparent water. Fine pale sand, smooth blue-grey river pebbles, delicate mottled mineral textures, a few scattered small dark stones and two or three tiny submerged green water plants. Uniform cool celadon porcelain-green water tint, even soft diffuse lighting. Absolutely flat calm surface: NO waves, NO ripples, NO light patterns, NO caustics, NO reflections on the surface. No lotus leaves, no flowers, no fish, no animals, no people, no text, no borders, no dry land, no horizon. Simple quiet painterly game-art texture, restrained porcelain-teal and sage palette, the center fully open and even. Fill every pixel with the underwater bed.
