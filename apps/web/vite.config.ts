import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // 모노레포 구조 특성상 루트 폴더의 .env를 명시적으로 읽어옵니다.
  const env = loadEnv(mode, "../..", "");

  return {
    plugins: [react()],
    envDir: "../..",
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: env.VITE_API_BASE || "http://localhost:4000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    // 모노레포: 클라이언트에는 VITE_ 접두사만 노출되므로 루트 .env의 서버 비밀값은 번들에 실리지 않는다.
  };
});
