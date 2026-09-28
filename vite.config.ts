import { defineConfig } from 'vite';

// base './'：产物可在 file:// 下直接加载（Lively Wallpaper 以文件方式挂载网页壁纸）
export default defineConfig({
  base: './',
  build: { assetsInlineLimit: 0 },
});
