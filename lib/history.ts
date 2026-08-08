import type { Collection } from "mongodb";

import { toTelemetryEvent } from "@/lib/telemetry";
import type {
  StoredTelemetryEvent,
  TelemetryEvent,
} from "@/types/telemetry";

export type HistoryRange = {
  deviceId: string;
  from: Date;
  to: Date;
};

export async function findTelemetryHistory(
  collection: Collection<StoredTelemetryEvent>,
  range: HistoryRange,
): Promise<TelemetryEvent[]> {
  const items = await collection
    .find(
      {
        deviceId: range.deviceId,
        occurredAt: { $gte: range.from, $lte: range.to },
      },
      { projection: { _id: 0 } },
    )
    .sort({ occurredAt: 1, seq: 1 })
    .toArray();

  return items.map(toTelemetryEvent);
}
