import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/interaction-api": {
          target: "http://localhost:4000",
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(/^\/interaction-api/, "/api"),
        },
        "/interaction-assets": {
          target: "http://localhost:4000",
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(/^\/interaction-assets/, "/dreamy_assets"),
        },
        "/api": {
          target:
            env.VITE_BACKEND_PROXY_TARGET ||
            "http://localhost:8080",
          changeOrigin: true,
          // 백엔드 CORS 허용 목록이 http://localhost:5173 뿐이라, 앱을 127.0.0.1 로
          // 열든 localhost 로 열든 항상 이 Origin 으로 프록시한다. (안 그러면 403 Invalid CORS)
          headers: { origin: "http://localhost:5173" },
        },
        "/led-api": {
          target: "http://localhost:8765",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/led-api/, ""),
        },
      },
    },
  };
});
