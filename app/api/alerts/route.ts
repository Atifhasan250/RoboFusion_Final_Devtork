import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  listAcknowledgements,
  type AlertAcknowledgementDocument,
} from "@/lib/alerts";
import { COLLECTIONS, getDatabase } from "@/lib/mongodb";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const db = await getDatabase();
    const items = await listAcknowledgements(
      db.collection<AlertAcknowledgementDocument>(COLLECTIONS.alerts),
      query.limit,
    );
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid alert log query" }, { status: 400 });
    }
    console.error("Alert log request failed", error);
    return NextResponse.json({ error: "Alert log is unavailable" }, { status: 503 });
  }
}
