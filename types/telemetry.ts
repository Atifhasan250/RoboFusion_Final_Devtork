import { z } from "zod";

const nonEmptyId = z.string().trim().min(1).max(128);

export const telemetryEventSchema = z.object({
  eventId: nonEmptyId,
  deviceId: nonEmptyId,
  seq: z.number().int().nonnegative(),
  occurredAt: z.iso.datetime({ offset: true }),
  source: z.enum(["live", "catchup"]),
  ir: z.object({
    connected: z.boolean(),
    occupiedRaw: z.boolean().optional(),
  }),
  climate: z.object({
    connected: z.boolean(),
    temperatureC: z.number().finite().optional(),
    humidityPct: z.number().finite().min(0).max(100).optional(),
  }),
  presence: z.enum(["OCCUPIED", "EMPTY", "UNKNOWN"]),
  marker: z.enum(["RED", "BLUE", "YELLOW", "GREEN", "UNKNOWN"]),
  overallStatus: z.enum(["SAFE", "WARNING", "DANGER"]),
  trend: z.enum(["RISING", "STABLE", "FALLING"]),
  connectionState: z.enum(["LIVE", "OFFLINE", "CATCHING_UP"]),
  storage: z
    .object({
      limitBytes: z.number().int().positive(),
      usedBytes: z.number().int().nonnegative(),
      clearedRecords: z.number().int().nonnegative(),
    })
    .optional(),
  alert: z
    .object({
      alertId: nonEmptyId,
      state: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]),
      acknowledgedBy: z.enum(["physical", "dashboard"]).optional(),
      acknowledgedAt: z.iso.datetime({ offset: true }).optional(),
    })
    .optional(),
});

export const deviceStateSchema = telemetryEventSchema.omit({
  eventId: true,
  source: true,
});

const telemetryBatchSchema = z
  .array(telemetryEventSchema)
  .min(1)
  .max(256)
  .superRefine((events, ctx) => {
    for (let index = 1; index < events.length; index += 1) {
      const previous = events[index - 1];
      const current = events[index];
      if (current.deviceId !== previous.deviceId) {
        ctx.addIssue({
          code: "custom",
          path: [index, "deviceId"],
          message: "A batch must contain events from one device",
        });
      }
      if (current.seq <= previous.seq) {
        ctx.addIssue({
          code: "custom",
          path: [index, "seq"],
          message: "Batch events must be in strictly ascending seq order",
        });
      }
    }
  });

export const ingestRequestSchema = z
  .union([
    z.object({ event: telemetryEventSchema }).strict(),
    z.object({ events: telemetryBatchSchema }).strict(),
  ])
  .transform((payload) => ("event" in payload ? [payload.event] : payload.events));

export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;
export type DeviceState = z.infer<typeof deviceStateSchema>;

export type StoredTelemetryEvent = Omit<TelemetryEvent, "occurredAt"> & {
  occurredAt: Date;
};
