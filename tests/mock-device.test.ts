import { describe, expect, it } from "vitest";

import { MockDeviceAdapter } from "@/lib/mock-device";

describe("mock device adapter", () => {
  it("uses the same ordered, bounded record contract as the real adapter", async () => {
    const device = new MockDeviceAdapter();
    const records = await device.getRecords(256);

    expect(records.length).toBeLessThanOrEqual(256);
    expect(records.every((item) => item.deviceId === "mock-device")).toBe(true);
    expect(records.map((item) => item.seq)).toEqual(
      [...records].sort((a, b) => a.seq - b.seq).map((item) => item.seq),
    );
  });

  it("accepts only the first acknowledgement for an alert", async () => {
    const device = new MockDeviceAdapter();
    const [first, second] = await Promise.all([
      device.acknowledgeAlert("alert-x", {
        requestId: "one",
        source: "dashboard",
      }),
      device.acknowledgeAlert("alert-x", {
        requestId: "two",
        source: "dashboard",
      }),
    ]);

    expect([first.accepted, second.accepted].sort()).toEqual([false, true]);
    expect(first.acknowledgedAt).toBe(second.acknowledgedAt);
  });
});
