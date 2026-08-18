import { defineConfig } from 'vite'
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
      "/api": "http://localhost:8080"
    }
  }
})
