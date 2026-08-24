import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/interaction-api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/interaction-api/, "/api"),
      },
      "/interaction-assets": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/interaction-assets/, "/dreamy_assets"),
      },
      "/api": {
        target: env.VITE_BACKEND_PROXY_TARGET || "http://localhost:8080", // 백엔드 배포 주소 or 백엔드 로컬 주소
        changeOrigin: true,
      }
    }
  }
})
