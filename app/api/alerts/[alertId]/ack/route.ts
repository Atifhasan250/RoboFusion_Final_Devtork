import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import {
  acknowledgeDeviceAlert,
  type AlertAcknowledgementDocument,
} from "@/lib/alerts";
import { getDeviceAdapter } from "@/lib/device-client";
import { COLLECTIONS, getDatabase } from "@/lib/mongodb";
import { acknowledgementRequestSchema } from "@/types/alerts";

const alertIdSchema = z.string().trim().min(1).max(128);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ alertId: string }> },
) {
  try {
    const alertId = alertIdSchema.parse((await params).alertId);
    const acknowledgement = acknowledgementRequestSchema.parse(
      await request.json(),
    );
    const db = await getDatabase();
    const result = await acknowledgeDeviceAlert(
      getDeviceAdapter(),
      db.collection<AlertAcknowledgementDocument>(COLLECTIONS.alerts),
      alertId,
      acknowledgement,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid acknowledgement request" },
        { status: 400 },
      );
    }
    console.error("Alert acknowledgement failed", error);
    return NextResponse.json(
      { error: "Device acknowledgement failed" },
      { status: 502 },
    );
  }
}
