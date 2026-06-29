// MSW 브라우저 워커 — main.tsx에서 VITE_MOCK_API=1 일 때만 동적 import.
import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
