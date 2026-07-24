import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const serverTarget = process.env.VITE_DEV_SERVER_TARGET ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': { target: serverTarget, changeOrigin: true },
      // 分享与托管页面均使用带资源 ID 的路径。显式尾斜线可避免 `/s` 前缀误匹配 `/src`。
      '/s/': { target: serverTarget, changeOrigin: true },
      '/site/': { target: serverTarget, changeOrigin: true },
    },
  },
})
