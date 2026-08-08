import type { Collection } from "mongodb";

import type {
  StoredTelemetryEvent,
  TelemetryEvent,
} from "@/types/telemetry";

export type IngestResult = {
  accepted: number;
  duplicates: number;
  lastSeq: number;
};

function duplicateOnlyBulkResult(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as {
    writeErrors?: Array<{ code?: number }>;
    result?: { upsertedCount?: number };
  };
  if (
    !candidate.writeErrors?.length ||
    !candidate.writeErrors.every((writeError) => writeError.code === 11000) ||
    typeof candidate.result?.upsertedCount !== "number"
  ) {
    return null;
  }
  return candidate.result.upsertedCount;
}

function toStoredEvent(event: TelemetryEvent): StoredTelemetryEvent {
  return {
    ...event,
    occurredAt: new Date(event.occurredAt),
  };
}

export function toTelemetryEvent(event: StoredTelemetryEvent): TelemetryEvent {
  return {
    ...event,
    occurredAt: event.occurredAt.toISOString(),
  };
}

export async function ingestTelemetry(
  collection: Collection<StoredTelemetryEvent>,
  events: TelemetryEvent[],
): Promise<IngestResult> {
  let accepted: number;
  try {
    const result = await collection.bulkWrite(
      events.map((event) => ({
        updateOne: {
          filter: { eventId: event.eventId },
          update: { $setOnInsert: toStoredEvent(event) },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    accepted = result.upsertedCount;
  } catch (error) {
    const upsertedBeforeDuplicateRace = duplicateOnlyBulkResult(error);
    if (upsertedBeforeDuplicateRace === null) throw error;
    accepted = upsertedBeforeDuplicateRace;
  }

  return {
    accepted,
    duplicates: events.length - accepted,
    lastSeq: events.at(-1)?.seq ?? 0,
  };
}

export async function findLatestTelemetry(
  collection: Collection<StoredTelemetryEvent>,
  deviceId: string,
): Promise<TelemetryEvent | null> {
  const event = await collection.findOne(
    { deviceId },
    { sort: { seq: -1 }, projection: { _id: 0 } },
  );

  return event ? toTelemetryEvent(event) : null;
}
