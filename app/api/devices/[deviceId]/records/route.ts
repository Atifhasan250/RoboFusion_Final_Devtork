import { NextResponse } from "next/server";
import { z } from "zod";

import { getDeviceAdapter } from "@/lib/device-client";

const limitSchema = z.coerce.number().int().min(1).max(256).default(256);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const { deviceId } = await params;
  const limit = limitSchema.safeParse(
    new URL(request.url).searchParams.get("limit") ?? undefined,
  );
  if (!deviceId.trim() || !limit.success) {
    return NextResponse.json(
      { error: "A deviceId and limit from 1 to 256 are required" },
      { status: 400 },
    );
  }

  try {
    const items = await getDeviceAdapter().getRecords(limit.data);
    if (items.some((item) => item.deviceId !== deviceId)) {
      return NextResponse.json(
        { error: "Connected deviceId does not match the requested device" },
        { status: 502 },
      );
    }
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    console.error("Device records request failed", error);
    return NextResponse.json({ error: "Device is unavailable" }, { status: 502 });
  }
}
