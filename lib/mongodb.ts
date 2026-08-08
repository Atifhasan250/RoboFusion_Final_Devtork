import { Db, MongoClient } from "mongodb";

import { getServerEnv } from "@/lib/env";
import type { StoredTelemetryEvent } from "@/types/telemetry";

declare global {
  var __robofusionMongoClientPromise: Promise<MongoClient> | undefined;
}

export const COLLECTIONS = {
  telemetry: "telemetry_events",
  alerts: "alerts",
} as const;

export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db
      .collection<StoredTelemetryEvent>(COLLECTIONS.telemetry)
      .createIndex({ eventId: 1 }, { unique: true, name: "eventId_unique" }),
    db
      .collection<StoredTelemetryEvent>(COLLECTIONS.telemetry)
      .createIndex(
        { deviceId: 1, occurredAt: 1 },
        { name: "device_history_range" },
      ),
    db.collection(COLLECTIONS.alerts).createIndex(
      { alertId: 1 },
      { unique: true, name: "alertId_unique" },
    ),
  ]);
}

export async function getDatabase(): Promise<Db> {
  const env = getServerEnv();
  globalThis.__robofusionMongoClientPromise ??= new MongoClient(
    env.MONGODB_URI,
  ).connect();
  const client = await globalThis.__robofusionMongoClientPromise;
  const db = client.db(env.MONGODB_DB);
  await ensureIndexes(db);
  return db;
}
