import { describe, expect, it, vi } from "vitest";

import { ensureIndexes } from "@/lib/mongodb";

describe("Mongo indexes", () => {
  it("creates idempotency, history, and alert indexes", async () => {
    const createIndex = vi.fn().mockResolvedValue("ok");
    const db = {
      collection: vi.fn(() => ({ createIndex })),
    };

    await ensureIndexes(db as never);

    expect(createIndex).toHaveBeenCalledWith(
      { eventId: 1 },
      { unique: true, name: "eventId_unique" },
    );
    expect(createIndex).toHaveBeenCalledWith(
      { deviceId: 1, occurredAt: 1 },
      { name: "device_history_range" },
    );
    expect(createIndex).toHaveBeenCalledWith(
      { alertId: 1 },
      { unique: true, name: "alertId_unique" },
    );
  });
});
