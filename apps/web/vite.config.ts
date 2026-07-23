import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const serverTarget = process.env.VITE_DEV_SERVER_TARGET ?? 'http://localhost:8787'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // 联调时代理 API、临时分享页和正式发布页到本地 Hono 服务。
      '/api': { target: serverTarget, changeOrigin: true },
      '/s': { target: serverTarget, changeOrigin: true },
      '/site': { target: serverTarget, changeOrigin: true },
    },
  },
})
