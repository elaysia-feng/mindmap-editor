import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  // Release 运行包使用相对资源路径，可部署到任意静态服务器或 GitHub Pages。
  base: './',
  plugins: [vue()],
});
