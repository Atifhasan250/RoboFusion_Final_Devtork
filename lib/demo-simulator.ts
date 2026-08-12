import type {
  AcknowledgementLogItem,
  AcknowledgementResult,
} from "@/types/alerts";
import type { DeviceState, TelemetryEvent } from "@/types/telemetry";

export const DEMO_DEVICE_ID = "robofusion-demo";

const BASE_SEQ = 1034;
const RECORD_CAPACITY = 256;
const HISTORY_CAPACITY = 512;
const STORAGE_LIMIT_BYTES = 170 * 1024;
const MARKERS = ["RED", "BLUE", "YELLOW", "GREEN", "UNKNOWN"] as const;
const TEMPERATURE_CYCLE = [
  27, 27.5, 28, 28.5, 29, 29.5, 30, 31, 32, 33,
  34, 34.5, 35, 36, 36.5, 35.5, 34, 32, 30, 28,
] as const;

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function connectionAt(relativeSeq: number): TelemetryEvent["connectionState"] {
  const phase = modulo(relativeSeq, 36);
  if (phase >= 22 && phase < 28) return "OFFLINE";
  if (phase >= 28 && phase < 32) return "CATCHING_UP";
  return "LIVE";
}

function safetyAt(relativeSeq: number) {
  const phase = modulo(relativeSeq + 12, TEMPERATURE_CYCLE.length);
  const previousPhase = modulo(phase - 1, TEMPERATURE_CYCLE.length);
  const temperatureC = TEMPERATURE_CYCLE[phase];
  const previousTemperatureC = TEMPERATURE_CYCLE[previousPhase];
  const humidityPct = Math.min(92, 60 + (temperatureC - 27) * 3.2);
  const overallStatus =
    temperatureC >= 35 || humidityPct >= 85
      ? "DANGER"
      : temperatureC >= 30 || humidityPct >= 70
        ? "WARNING"
        : "SAFE";
  const delta = temperatureC - previousTemperatureC;
  const trend = delta > 0.2 ? "RISING" : delta < -0.2 ? "FALLING" : "STABLE";

  return { phase, temperatureC, humidityPct, overallStatus, trend } as const;
}

export type DemoSimulatorSnapshot = {
  state: DeviceState;
  records: TelemetryEvent[];
  acknowledgements: AcknowledgementLogItem[];
};

export class DemoSimulator {
  private readonly acknowledgements = new Map<string, AcknowledgementLogItem>();

  constructor(private readonly startedAt = Date.now()) {
    const seeded = [
      {
        alertId: "demo-alert-39",
        acknowledgedBy: "physical" as const,
        offsetMs: -8 * 60_000,
        winningRequestId: undefined,
      },
      {
        alertId: "demo-alert-40",
        acknowledgedBy: "dashboard" as const,
        offsetMs: -5 * 60_000,
        winningRequestId: "demo-request-40",
      },
      {
        alertId: "demo-alert-41",
        acknowledgedBy: "physical" as const,
        offsetMs: -2 * 60_000,
        winningRequestId: undefined,
      },
    ];

    for (const item of seeded) {
      this.acknowledgements.set(item.alertId, {
        alertId: item.alertId,
        deviceId: DEMO_DEVICE_ID,
        state: "ACKNOWLEDGED",
        acknowledgedBy: item.acknowledgedBy,
        acknowledgedAt: new Date(this.startedAt + item.offsetMs).toISOString(),
        ...(item.winningRequestId
          ? { winningRequestId: item.winningRequestId }
          : {}),
      });
    }
  }

  private currentSeq(now: number): number {
    return BASE_SEQ + Math.floor(Math.max(0, now - this.startedAt) / 2000);
  }

  private eventAt(seq: number): TelemetryEvent {
    const relativeSeq = seq - BASE_SEQ;
    const connectionState = connectionAt(relativeSeq);
    const safety = safetyAt(relativeSeq);
    const occupied = modulo(seq, 12) >= 5;
    const irFault = modulo(seq, 67) === 0;
    const climateFault = modulo(seq, 89) === 0;
    const dangerEpisode = 42 + Math.floor((relativeSeq + 12) / 20);
    const alertId = `demo-alert-${dangerEpisode}`;
    const acknowledgement = this.acknowledgements.get(alertId);
    const clearedRecords = Math.max(0, seq - 700);
    const usedBytes = Math.min(
      STORAGE_LIMIT_BYTES,
      118 * 1024 + modulo(seq, 145) * 320,
    );

    return {
      eventId: `${DEMO_DEVICE_ID}-${seq}`,
      deviceId: DEMO_DEVICE_ID,
      seq,
      occurredAt: new Date(
        this.startedAt + relativeSeq * 2000,
      ).toISOString(),
      source: connectionState === "CATCHING_UP" ? "catchup" : "live",
      ir: {
        connected: !irFault,
        ...(!irFault ? { occupiedRaw: occupied } : {}),
      },
      climate: {
        connected: !climateFault,
        ...(!climateFault
          ? {
              temperatureC: safety.temperatureC,
              humidityPct: Number(safety.humidityPct.toFixed(1)),
            }
          : {}),
      },
      presence: occupied ? "OCCUPIED" : "EMPTY",
      marker: MARKERS[modulo(seq, MARKERS.length)],
      overallStatus: safety.overallStatus,
      trend: safety.trend,
      connectionState,
      storage: {
        limitBytes: STORAGE_LIMIT_BYTES,
        usedBytes,
        clearedRecords,
      },
      ...(safety.overallStatus === "DANGER"
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

  snapshot(now = Date.now()): DemoSimulatorSnapshot {
    const seq = this.currentSeq(now);
    const firstSeq = seq - RECORD_CAPACITY + 1;
    const records = Array.from({ length: RECORD_CAPACITY }, (_, index) =>
      this.eventAt(firstSeq + index),
    );
    const latest = records.at(-1);
    if (!latest) throw new Error("Demo simulator failed to create its current state");
    const { eventId: _eventId, source: _source, ...state } = latest;
    void _eventId;
    void _source;

    return {
      state,
      records,
      acknowledgements: [...this.acknowledgements.values()].sort((left, right) =>
        right.acknowledgedAt.localeCompare(left.acknowledgedAt),
      ),
    };
  }

  search(from: Date, to: Date, now = Date.now()): TelemetryEvent[] {
    const seq = this.currentSeq(now);
    const firstSeq = seq - HISTORY_CAPACITY + 1;
    return Array.from({ length: HISTORY_CAPACITY }, (_, index) =>
      this.eventAt(firstSeq + index),
    ).filter((event) => {
      const occurredAt = new Date(event.occurredAt).getTime();
      return occurredAt >= from.getTime() && occurredAt <= to.getTime();
    });
  }

  acknowledge(
    alertId: string,
    requestId: string,
    now = Date.now(),
  ): AcknowledgementResult {
    const existing = this.acknowledgements.get(alertId);
    if (existing) {
      return {
        alertId,
        accepted: false,
        acknowledgedBy: existing.acknowledgedBy,
        acknowledgedAt: existing.acknowledgedAt,
      };
    }

    const currentAlert = this.eventAt(this.currentSeq(now)).alert;
    if (!currentAlert || currentAlert.alertId !== alertId) {
      throw new Error("This simulated alert is no longer open.");
    }

    const acknowledgedAt = new Date(now).toISOString();
    this.acknowledgements.set(alertId, {
      alertId,
      deviceId: DEMO_DEVICE_ID,
      state: "ACKNOWLEDGED",
      acknowledgedBy: "dashboard",
      acknowledgedAt,
      winningRequestId: requestId,
    });

    return {
      alertId,
      accepted: true,
      acknowledgedBy: "dashboard",
      acknowledgedAt,
    };
  }
}

