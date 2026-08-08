import type {
  AcknowledgementRequest,
  AcknowledgementResult,
} from "@/types/alerts";
import type { DeviceAdapter } from "@/types/device";
import {
  deviceStateSchema,
  type DeviceState,
  type TelemetryEvent,
} from "@/types/telemetry";

export class MockDeviceAdapter implements DeviceAdapter {
  private readonly startedAt = Date.now();
  private readonly acknowledgements = new Map<
    string,
    Omit<AcknowledgementResult, "accepted">
  >();

  private currentSeq(): number {
    return Math.floor((Date.now() - this.startedAt) / 2000) + 1;
  }

  private eventAt(seq: number): TelemetryEvent {
    const danger = seq % 12 >= 9;
    const warning = !danger && seq % 12 >= 6;
    const alertId = `mock-alert-${Math.floor(seq / 12)}`;
    const acknowledgement = this.acknowledgements.get(alertId);
    return {
      eventId: `mock-device-${seq}`,
      deviceId: "mock-device",
      seq,
      occurredAt: new Date(this.startedAt + (seq - 1) * 2000).toISOString(),
      source: "live",
      ir: { connected: true, occupiedRaw: seq % 6 >= 3 },
      climate: {
        connected: true,
        temperatureC: 27 + (seq % 8),
        humidityPct: 62 + (seq % 10),
      },
      presence: seq % 6 >= 3 ? "OCCUPIED" : "EMPTY",
      marker: (["RED", "BLUE", "YELLOW", "GREEN", "UNKNOWN"] as const)[
        seq % 5
      ],
      overallStatus: danger ? "DANGER" : warning ? "WARNING" : "SAFE",
      trend: danger || warning ? "RISING" : "STABLE",
      connectionState: "LIVE",
      storage: {
        limitBytes: 170 * 1024,
        usedBytes: Math.min(seq * 320, 170 * 1024),
        clearedRecords: Math.max(0, seq - 544),
      },
      ...(danger
        ? {
            alert: acknowledgement
              ? {
                  alertId,
                  state: "ACKNOWLEDGED" as const,
                  acknowledgedBy: acknowledgement.acknowledgedBy,
                  acknowledgedAt: acknowledgement.acknowledgedAt,
                }
              : { alertId, state: "OPEN" as const },
          }
        : {}),
    };
  }

  async getState(): Promise<DeviceState> {
    return deviceStateSchema.parse(this.eventAt(this.currentSeq()));
  }

  async getRecords(limit = 256): Promise<TelemetryEvent[]> {
    const seq = this.currentSeq();
    const count = Math.min(Math.max(limit, 0), seq, 256);
    const first = seq - count + 1;
    return Array.from({ length: count }, (_, index) =>
      this.eventAt(first + index),
    );
  }

  async acknowledgeAlert(
    alertId: string,
    request: AcknowledgementRequest,
  ): Promise<AcknowledgementResult> {
    void request;
    const existing = this.acknowledgements.get(alertId);
    if (existing) {
      return { ...existing, accepted: false };
    }
    const result = {
      alertId,
      acknowledgedBy: "dashboard" as const,
      acknowledgedAt: new Date().toISOString(),
    };
    this.acknowledgements.set(alertId, result);
    return { ...result, accepted: true };
  }
}
