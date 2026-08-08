import type { Collection } from "mongodb";
import { describe, expect, it } from "vitest";

import {
  acknowledgeDeviceAlert,
  type AlertAcknowledgementDocument,
} from "@/lib/alerts";
import type { AcknowledgementRequest } from "@/types/alerts";
import type { DeviceAdapter } from "@/types/device";

function authoritativeDevice(): DeviceAdapter {
  const acknowledged = new Map<
    string,
    { acknowledgedBy: "dashboard"; acknowledgedAt: string }
  >();
  return {
    async getState() {
      throw new Error("not needed");
    },
    async getRecords() {
      return [];
    },
    async acknowledgeAlert(alertId: string) {
      const existing = acknowledged.get(alertId);
      if (existing) {
        return { alertId, accepted: false, ...existing };
      }
      const winner = {
        acknowledgedBy: "dashboard" as const,
        acknowledgedAt: "2026-08-08T05:51:01.000Z",
      };
      acknowledged.set(alertId, winner);
      return { alertId, accepted: true, ...winner };
    },
  };
}

function alertCollection() {
  const rows = new Map<string, AlertAcknowledgementDocument>();
  return {
    rows,
    collection: {
      async updateOne(
        filter: { alertId: string; winningRequestId?: { $exists: boolean } },
        update: {
          $setOnInsert?: AlertAcknowledgementDocument;
          $set?: { winningRequestId: string };
        },
      ) {
        let row = rows.get(filter.alertId);
        if (!row && update.$setOnInsert) {
          row = { ...update.$setOnInsert };
          rows.set(filter.alertId, row);
        }
        if (row && update.$set && !row.winningRequestId) {
          Object.assign(row, update.$set);
        }
        return { acknowledged: true };
      },
    } as unknown as Collection<AlertAcknowledgementDocument>,
  };
}

const request = (requestId: string): AcknowledgementRequest => ({
  requestId,
  source: "dashboard",
});

describe("alert acknowledgement", () => {
  it("records exactly one winner for simultaneous attempts on one alert", async () => {
    const device = authoritativeDevice();
    const { collection, rows } = alertCollection();

    const results = await Promise.all([
      acknowledgeDeviceAlert(device, collection, "alert-42", request("a")),
      acknowledgeDeviceAlert(device, collection, "alert-42", request("b")),
    ]);

    expect(results.filter((result) => result.accepted)).toHaveLength(1);
    expect(rows).toHaveLength(1);
    expect(rows.get("alert-42")?.winningRequestId).toBe("a");
  });

  it("keeps separate alertIds independent", async () => {
    const device = authoritativeDevice();
    const { collection, rows } = alertCollection();

    await Promise.all([
      acknowledgeDeviceAlert(device, collection, "alert-1", request("one")),
      acknowledgeDeviceAlert(device, collection, "alert-2", request("two")),
    ]);

    expect([...rows.keys()].sort()).toEqual(["alert-1", "alert-2"]);
  });

  it("returns the device result when a concurrent mirror insert loses", async () => {
    const device = authoritativeDevice();
    let calls = 0;
    const collection = {
      async updateOne() {
        calls += 1;
        if (calls === 1) throw { code: 11000 };
        return { acknowledged: true };
      },
    } as unknown as Collection<AlertAcknowledgementDocument>;

    await expect(
      acknowledgeDeviceAlert(device, collection, "alert-race", request("winner")),
    ).resolves.toMatchObject({ alertId: "alert-race", accepted: true });
  });
});
