import type { Collection } from "mongodb";

import type {
  AcknowledgementRequest,
  AcknowledgementResult,
} from "@/types/alerts";
import type { DeviceAdapter } from "@/types/device";

export type AlertAcknowledgementDocument = {
  alertId: string;
  state: "ACKNOWLEDGED";
  acknowledgedBy: "physical" | "dashboard";
  acknowledgedAt: Date;
  winningRequestId?: string;
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
