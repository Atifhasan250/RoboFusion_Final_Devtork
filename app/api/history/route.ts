import { NextResponse } from "next/server";
import { z } from "zod";

import { findTelemetryHistory } from "@/lib/history";
import { COLLECTIONS, getDatabase } from "@/lib/mongodb";
import type { StoredTelemetryEvent } from "@/types/telemetry";

const historyQuerySchema = z
  .object({
    deviceId: z.string().trim().min(1).max(128),
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
  })
  .refine((query) => Date.parse(query.from) <= Date.parse(query.to), {
    path: ["to"],
    message: "to must be at or after from",
  });

export async function GET(request: Request) {
  const parsed = historyQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "deviceId, from, and to must define a valid time range" },
      { status: 400 },
    );
  }

  try {
    const db = await getDatabase();
    const items = await findTelemetryHistory(
      db.collection<StoredTelemetryEvent>(COLLECTIONS.telemetry),
      {
        deviceId: parsed.data.deviceId,
        from: new Date(parsed.data.from),
        to: new Date(parsed.data.to),
      },
    );
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    console.error("History lookup failed", error);
    return NextResponse.json({ error: "History lookup failed" }, { status: 500 });
  }
}
