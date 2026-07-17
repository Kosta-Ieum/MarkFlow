import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // 모노레포 구조 특성상 루트 폴더의 .env를 명시적으로 읽어옵니다.
  const env = loadEnv(mode, "../..", "");
  // REST·소켓 모두 같은 Nest 서버(canvas.gateway는 REST와 같은 HTTP 서버 위에 얹힘)이므로
  // 프록시 대상은 하나만 있으면 된다.
  const backendTarget = env.VITE_API_BASE || "http://localhost:4000";

  return {
    plugins: [react()],
    envDir: "../..",
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        // socket.io-client 기본 경로 — ws:true로 웹소켓 업그레이드까지 프록시해야
        // 브라우저가 cross-site 핸드셰이크로 인식해 연결을 막는 문제를 피할 수 있다.
        "/socket.io": {
          target: backendTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    // 모노레포: 클라이언트에는 VITE_ 접두사만 노출되므로 루트 .env의 서버 비밀값은 번들에 실리지 않는다.
  };
});
