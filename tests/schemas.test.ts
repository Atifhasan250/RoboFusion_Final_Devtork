import { describe, expect, it } from "vitest";

import { ingestRequestSchema, telemetryEventSchema } from "@/types/telemetry";

const event = {
  eventId: "rf-01-1",
  deviceId: "rf-01",
  seq: 1,
  occurredAt: "2026-08-08T05:50:00.000Z",
  source: "catchup" as const,
  ir: { connected: true, occupiedRaw: false },
  climate: { connected: true, temperatureC: 28, humidityPct: 70 },
  presence: "EMPTY" as const,
  marker: "UNKNOWN" as const,
  overallStatus: "SAFE" as const,
  trend: "STABLE" as const,
  connectionState: "CATCHING_UP" as const,
};

describe("telemetry contracts", () => {
  it("accepts a complete device-authoritative event", () => {
    expect(telemetryEventSchema.parse(event)).toEqual(event);
  });

  it("rejects a reversed catch-up batch", () => {
    const result = ingestRequestSchema.safeParse({
      events: [event, { ...event, eventId: "rf-01-0", seq: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("does not invent missing authoritative values", () => {
    const result = telemetryEventSchema.safeParse({
      ...event,
      overallStatus: undefined,
    });
    expect(result.success).toBe(false);
  });
});
