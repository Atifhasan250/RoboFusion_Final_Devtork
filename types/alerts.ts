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

export const acknowledgementLogItemSchema = z.object({
  alertId: z.string().trim().min(1).max(128),
  deviceId: z.string().trim().min(1).max(128).optional(),
  state: z.literal("ACKNOWLEDGED"),
  acknowledgedBy: z.enum(["physical", "dashboard"]),
  acknowledgedAt: z.iso.datetime({ offset: true }),
  winningRequestId: z.string().trim().min(1).max(128).optional(),
});

export type AcknowledgementRequest = z.infer<
  typeof acknowledgementRequestSchema
>;
export type AcknowledgementResult = z.infer<
  typeof acknowledgementResultSchema
>;
export type AcknowledgementLogItem = z.infer<
  typeof acknowledgementLogItemSchema
>;
