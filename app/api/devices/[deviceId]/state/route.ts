import { NextResponse } from "next/server";

import { getDeviceAdapter } from "@/lib/device-client";

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
    return NextResponse.json({ state });
  } catch (error) {
    console.error("Device state request failed", error);
    return NextResponse.json({ error: "Device is unavailable" }, { status: 502 });
  }
}
