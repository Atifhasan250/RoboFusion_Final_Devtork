import { describe, expect, it } from "vitest";

import { DemoSimulator } from "@/lib/demo-simulator";

describe("portfolio demo simulator", () => {
  const startedAt = Date.parse("2026-08-12T10:00:00.000Z");

  it("starts with a fully populated, ordered 256-record device buffer", () => {
    const snapshot = new DemoSimulator(startedAt).snapshot(startedAt);

    expect(snapshot.records).toHaveLength(256);
    expect(snapshot.records.map((event) => event.seq)).toEqual(
      [...snapshot.records].sort((left, right) => left.seq - right.seq).map(
        (event) => event.seq,
      ),
    );
    expect(snapshot.state.deviceId).toBe("robofusion-demo");
    expect(snapshot.state.storage?.limitBytes).toBe(170 * 1024);
    expect(snapshot.acknowledgements.length).toBeGreaterThan(0);
  });

  it("searches the deterministic history inclusively", () => {
    const simulator = new DemoSimulator(startedAt);
    const snapshot = simulator.snapshot(startedAt);
    const target = snapshot.records.at(-10);
    expect(target).toBeDefined();
    if (!target) return;

    const results = simulator.search(
      new Date(target.occurredAt),
      new Date(target.occurredAt),
      startedAt,
    );

    expect(results.map((event) => event.eventId)).toEqual([target.eventId]);
  });

  it("accepts only the first acknowledgement for the current alert", () => {
    const simulator = new DemoSimulator(startedAt);
    const alertId = simulator.snapshot(startedAt).state.alert?.alertId;
    expect(alertId).toBeDefined();
    if (!alertId) return;

    const first = simulator.acknowledge(alertId, "request-one", startedAt);
    const second = simulator.acknowledge(alertId, "request-two", startedAt);

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(false);
    expect(second.acknowledgedAt).toBe(first.acknowledgedAt);
    expect(
      simulator.snapshot(startedAt).acknowledgements.filter(
        (item) => item.alertId === alertId,
      ),
    ).toHaveLength(1);
  });
});
