import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ingestTelemetry } from "@/lib/telemetry";
import { COLLECTIONS, getDatabase } from "@/lib/mongodb";
import {
  ingestRequestSchema,
  type StoredTelemetryEvent,
} from "@/types/telemetry";

export async function POST(request: Request) {
  try {
    const events = ingestRequestSchema.parse(await request.json());
    const db = await getDatabase();
    const result = await ingestTelemetry(
      db.collection<StoredTelemetryEvent>(COLLECTIONS.telemetry),
      events,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid telemetry payload" },
        { status: 400 },
      );
    }
    console.error("Telemetry ingest failed", error);
    return NextResponse.json({ error: "Telemetry ingest failed" }, { status: 500 });
  }
}
