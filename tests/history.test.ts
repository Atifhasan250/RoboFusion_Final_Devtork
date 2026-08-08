import type { Collection } from "mongodb";
import { describe, expect, it } from "vitest";

import { findTelemetryHistory } from "@/lib/history";
import type { StoredTelemetryEvent } from "@/types/telemetry";

function storedEvent(seq: number, occurredAt: string): StoredTelemetryEvent {
  return {
    eventId: `rf-01-${seq}`,
    deviceId: "rf-01",
    seq,
    occurredAt: new Date(occurredAt),
    source: "catchup",
    ir: { connected: true },
    climate: { connected: true, temperatureC: 28, humidityPct: 70 },
    presence: "EMPTY",
    marker: "UNKNOWN",
    overallStatus: "SAFE",
    trend: "STABLE",
    connectionState: "LIVE",
  };
}

function historyCollection(rows: StoredTelemetryEvent[]) {
  return {
    find(filter: {
      deviceId: string;
      occurredAt: { $gte: Date; $lte: Date };
    }) {
      let matches = rows.filter(
        (row) =>
          row.deviceId === filter.deviceId &&
          row.occurredAt >= filter.occurredAt.$gte &&
          row.occurredAt <= filter.occurredAt.$lte,
      );
      return {
        sort() {
          matches = matches.sort(
            (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
          );
          return this;
        },
        async toArray() {
          return matches;
        },
      };
    },
  } as unknown as Collection<StoredTelemetryEvent>;
}

describe("history range search", () => {
  const collection = historyCollection([
    storedEvent(1, "2026-08-08T05:49:59.000Z"),
    storedEvent(2, "2026-08-08T05:50:00.000Z"),
    storedEvent(3, "2026-08-08T05:50:30.000Z"),
    storedEvent(4, "2026-08-08T05:51:00.000Z"),
    storedEvent(5, "2026-08-08T05:51:01.000Z"),
  ]);

  it("returns only records inside the inclusive range, oldest first", async () => {
    const items = await findTelemetryHistory(collection, {
      deviceId: "rf-01",
      from: new Date("2026-08-08T05:50:00.000Z"),
      to: new Date("2026-08-08T05:51:00.000Z"),
    });

    expect(items.map((item) => item.seq)).toEqual([2, 3, 4]);
  });

  it("returns a clean empty list when no records match", async () => {
    const items = await findTelemetryHistory(collection, {
      deviceId: "rf-01",
      from: new Date("2020-01-01T00:00:00.000Z"),
      to: new Date("2020-01-01T00:01:00.000Z"),
    });

    expect(items).toEqual([]);
  });
});
