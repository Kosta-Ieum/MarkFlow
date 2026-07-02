import { z } from "zod";

export const EdgeCreateRequestSchema = z.object({
  source: z.string().uuid(),
  target: z.string().uuid(),
});
export type EdgeCreateRequest = z.infer<typeof EdgeCreateRequestSchema>;

export interface EdgeDeleteResponse {
  id: string;
}
