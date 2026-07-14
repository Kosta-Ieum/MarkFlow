import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// esbuild(vite 기본 transform)는 emitDecoratorMetadata를 지원하지 않아 Nest의 암시적
// 타입 기반 생성자 DI가 조용히 실패한다(design:paramtypes 미생성). tsc 빌드(prod)는
// 영향 없음 — 테스트 실행(vitest)만 SWC로 전환해 데코레이터 메타데이터를 보존한다.
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
  },
});
