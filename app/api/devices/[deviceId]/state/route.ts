import { after, NextResponse } from "next/server";

import {
  mirrorDeviceAcknowledgement,
  type AlertAcknowledgementDocument,
} from "@/lib/alerts";
import { getDeviceAdapter } from "@/lib/device-client";
import { COLLECTIONS, getDatabase } from "@/lib/mongodb";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const { deviceId } = await params;
  if (!deviceId.trim()) {
    return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
  }

  try {
    const state = await getDeviceAdapter().getState();
    if (state.deviceId !== deviceId) {
      return NextResponse.json(
        { error: "Connected deviceId does not match the requested device" },
        { status: 502 },
      );
    }
    if (
      state.alert?.state === "ACKNOWLEDGED" &&
      state.alert.acknowledgedBy &&
      state.alert.acknowledgedAt
    ) {
      const acknowledgedAlert = {
        ...state.alert,
        state: "ACKNOWLEDGED" as const,
        acknowledgedBy: state.alert.acknowledgedBy,
        acknowledgedAt: state.alert.acknowledgedAt,
      };
      after(async () => {
        try {
          const db = await getDatabase();
          await mirrorDeviceAcknowledgement(
            db.collection<AlertAcknowledgementDocument>(COLLECTIONS.alerts),
            deviceId,
            acknowledgedAlert,
          );
        } catch (error) {
          console.error("Acknowledgement mirror failed", error);
        }
      });
    }
    return NextResponse.json({ state });
  } catch (error) {
    console.error("Device state request failed", error);
    return NextResponse.json({ error: "Device is unavailable" }, { status: 502 });
  }
}
