import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const serverTarget = process.env.VITE_DEV_SERVER_TARGET ?? 'http://localhost:8787'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': { target: serverTarget, changeOrigin: true },
      '^/s(?:/|$)': { target: serverTarget, changeOrigin: true },
      '^/site(?:/|$)': { target: serverTarget, changeOrigin: true },
    },
  },
})
