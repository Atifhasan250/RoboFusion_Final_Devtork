import { NextResponse } from "next/server";
import { z } from "zod";

import { COLLECTIONS, getDatabase } from "@/lib/mongodb";
import { findLatestTelemetry } from "@/lib/telemetry";
import type { StoredTelemetryEvent } from "@/types/telemetry";

const latestQuerySchema = z.object({
  deviceId: z.string().trim().min(1).max(128),
});

export async function GET(request: Request) {
  const parsed = latestQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    const item = await findLatestTelemetry(
      db.collection<StoredTelemetryEvent>(COLLECTIONS.telemetry),
      parsed.data.deviceId,
    );
    return NextResponse.json({ item });
  } catch (error) {
    console.error("Latest telemetry lookup failed", error);
    return NextResponse.json(
      { error: "Latest telemetry lookup failed" },
      { status: 500 },
    );
  }
}
