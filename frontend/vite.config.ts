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
        },
      },
    },
  };
});