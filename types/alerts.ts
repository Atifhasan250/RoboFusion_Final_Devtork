import { z } from "zod";

export const acknowledgementRequestSchema = z
  .object({
    requestId: z.string().trim().min(1).max(128),
    source: z.literal("dashboard"),
  })
  .strict();

export const acknowledgementResultSchema = z.object({
  alertId: z.string().trim().min(1).max(128),
  accepted: z.boolean(),
  acknowledgedBy: z.enum(["physical", "dashboard"]),
  acknowledgedAt: z.iso.datetime({ offset: true }),
});

export type AcknowledgementRequest = z.infer<
  typeof acknowledgementRequestSchema
>;
export type AcknowledgementResult = z.infer<
  typeof acknowledgementResultSchema
>;
