import type { Collection } from "mongodb";

import type {
  AcknowledgementLogItem,
  AcknowledgementRequest,
  AcknowledgementResult,
} from "@/types/alerts";
import type { DeviceAdapter } from "@/types/device";
import type { DeviceState } from "@/types/telemetry";

export type AlertAcknowledgementDocument = {
  alertId: string;
  deviceId?: string;
  state: "ACKNOWLEDGED";
  acknowledgedBy: "physical" | "dashboard";
  acknowledgedAt: Date;
  winningRequestId?: string;
};

type AcknowledgedDeviceAlert = NonNullable<DeviceState["alert"]> & {
  state: "ACKNOWLEDGED";
  acknowledgedBy: "physical" | "dashboard";
  acknowledgedAt: string;
};

function isDuplicateKeyError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

export async function acknowledgeDeviceAlert(
  device: DeviceAdapter,
  collection: Collection<AlertAcknowledgementDocument>,
  alertId: string,
  request: AcknowledgementRequest,
): Promise<AcknowledgementResult> {
  const result = await device.acknowledgeAlert(alertId, request);
  const finalState: AlertAcknowledgementDocument = {
    alertId,
    state: "ACKNOWLEDGED",
    acknowledgedBy: result.acknowledgedBy,
    acknowledgedAt: new Date(result.acknowledgedAt),
  };

  try {
    await collection.updateOne(
      { alertId },
      { $setOnInsert: finalState },
      { upsert: true },
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }

  if (result.accepted) {
    await collection.updateOne(
      { alertId, winningRequestId: { $exists: false } },
      { $set: { winningRequestId: request.requestId } },
    );
  }

  return result;
}

export async function mirrorDeviceAcknowledgement(
  collection: Collection<AlertAcknowledgementDocument>,
  deviceId: string,
  alert: AcknowledgedDeviceAlert,
): Promise<void> {
  const finalState: AlertAcknowledgementDocument = {
    alertId: alert.alertId,
    state: "ACKNOWLEDGED",
    acknowledgedBy: alert.acknowledgedBy,
    acknowledgedAt: new Date(alert.acknowledgedAt),
  };

  try {
    await collection.updateOne(
      { alertId: alert.alertId },
      {
        $setOnInsert: finalState,
        $set: { deviceId },
      },
      { upsert: true },
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
}

export async function listAcknowledgements(
  collection: Collection<AlertAcknowledgementDocument>,
  limit = 100,
): Promise<AcknowledgementLogItem[]> {
  const documents = await collection
    .find({})
    .sort({ acknowledgedAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 500))
    .toArray();

  return documents.map((document) => ({
    alertId: document.alertId,
    ...(document.deviceId ? { deviceId: document.deviceId } : {}),
    state: document.state,
    acknowledgedBy: document.acknowledgedBy,
    acknowledgedAt: document.acknowledgedAt.toISOString(),
    ...(document.winningRequestId
      ? { winningRequestId: document.winningRequestId }
      : {}),
  }));
}
