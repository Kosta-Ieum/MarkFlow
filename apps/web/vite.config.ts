import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // 모노레포: .env는 레포 루트에 있다(bootstrap이 루트에 생성). 기본 envDir(apps/web)로는
  // VITE_*를 못 읽어 localhost 폴백으로 동작하므로 루트를 지정한다(project root 기준 상대경로).
  // 클라이언트에는 VITE_ 접두사만 노출되므로 루트 .env의 서버 비밀값은 번들에 실리지 않는다.
  envDir: "../../",
});
