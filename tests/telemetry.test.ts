import type { Collection } from "mongodb";
import { describe, expect, it } from "vitest";

import { findLatestTelemetry, ingestTelemetry } from "@/lib/telemetry";
import type {
  StoredTelemetryEvent,
  TelemetryEvent,
} from "@/types/telemetry";

function makeEvent(seq: number): TelemetryEvent {
  return {
    eventId: `rf-01-${seq}`,
    deviceId: "rf-01",
    seq,
    occurredAt: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
    source: "catchup",
    ir: { connected: true, occupiedRaw: false },
    climate: { connected: true, temperatureC: 28, humidityPct: 70 },
    presence: "EMPTY",
    marker: "UNKNOWN",
    overallStatus: "SAFE",
    trend: "STABLE",
    connectionState: "CATCHING_UP",
  };
}

function memoryCollection() {
  const rows = new Map<string, StoredTelemetryEvent>();
  const collection = {
    async bulkWrite(operations: Array<{ updateOne: { filter: { eventId: string }; update: { $setOnInsert: StoredTelemetryEvent } } }>) {
      let upsertedCount = 0;
      for (const operation of operations) {
        const { eventId } = operation.updateOne.filter;
        if (!rows.has(eventId)) {
          rows.set(eventId, operation.updateOne.update.$setOnInsert);
          upsertedCount += 1;
        }
      }
      return { upsertedCount };
    },
    async findOne(filter: { deviceId: string }) {
      return (
        [...rows.values()]
          .filter((event) => event.deviceId === filter.deviceId)
          .sort((a, b) => b.seq - a.seq)[0] ?? null
      );
    },
  } as unknown as Collection<StoredTelemetryEvent>;

  return { collection, rows };
}

describe("telemetry ingest", () => {
  it("stores a retried catch-up batch exactly once without changing seq", async () => {
    const { collection, rows } = memoryCollection();
    const batch = [makeEvent(10), makeEvent(11), makeEvent(12)];

    const first = await ingestTelemetry(collection, batch);
    const retry = await ingestTelemetry(collection, batch);

    expect(first).toEqual({ accepted: 3, duplicates: 0, lastSeq: 12 });
    expect(retry).toEqual({ accepted: 0, duplicates: 3, lastSeq: 12 });
    expect([...rows.values()].map((event) => event.seq)).toEqual([10, 11, 12]);
  });

  it("returns the highest original device seq as latest", async () => {
    const { collection } = memoryCollection();
    await ingestTelemetry(collection, [makeEvent(20), makeEvent(21)]);

    const latest = await findLatestTelemetry(collection, "rf-01");

    expect(latest?.seq).toBe(21);
  });

  it("treats a concurrent unique-index loser as a duplicate", async () => {
    const collection = {
      async bulkWrite() {
        throw {
          writeErrors: [{ code: 11000 }],
          result: { upsertedCount: 1 },
        };
      },
    } as unknown as Collection<StoredTelemetryEvent>;

    await expect(
      ingestTelemetry(collection, [makeEvent(30), makeEvent(31)]),
    ).resolves.toEqual({ accepted: 1, duplicates: 1, lastSeq: 31 });
  });
});
