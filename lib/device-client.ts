import { getServerEnv } from "@/lib/env";
import { MockDeviceAdapter } from "@/lib/mock-device";
import {
  acknowledgementResultSchema,
  type AcknowledgementRequest,
  type AcknowledgementResult,
} from "@/types/alerts";
import type { DeviceAdapter } from "@/types/device";
import {
  deviceStateSchema,
  telemetryEventSchema,
  type DeviceState,
  type TelemetryEvent,
} from "@/types/telemetry";

export class RealDeviceAdapter implements DeviceAdapter {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { "content-type": "application/json", ...init?.headers },
    });
    if (!response.ok) {
      throw new Error(`Device request failed with HTTP ${response.status}`);
    }
    return response.json();
  }

  async getState(): Promise<DeviceState> {
    return deviceStateSchema.parse(await this.request("/api/v1/state"));
  }

  async getRecords(limit = 256): Promise<TelemetryEvent[]> {
    const payload = await this.request(`/api/v1/records?limit=${limit}`);
    const rawItems = Array.isArray(payload)
      ? payload
      : (payload as { items?: unknown }).items;
    return telemetryEventSchema.array().max(256).parse(rawItems);
  }

  async acknowledgeAlert(
    alertId: string,
    request: AcknowledgementRequest,
  ): Promise<AcknowledgementResult> {
    const payload = await this.request(
      `/api/v1/alerts/${encodeURIComponent(alertId)}/ack`,
      { method: "POST", body: JSON.stringify(request) },
    );
    const result = acknowledgementResultSchema.parse(payload);
    if (result.alertId !== alertId) {
      throw new Error("Device returned an acknowledgement for another alert");
    }
    return result;
  }
}

export function getDeviceAdapter(): DeviceAdapter {
  const env = getServerEnv();
  if (env.DEVICE_ADAPTER === "mock") {
    globalThis.__robofusionDeviceAdapter ??= new MockDeviceAdapter();
  } else {
    globalThis.__robofusionDeviceAdapter ??= new RealDeviceAdapter(
      env.DEVICE_BASE_URL,
      env.DEVICE_REQUEST_TIMEOUT_MS,
    );
  }
  return globalThis.__robofusionDeviceAdapter;
}

declare global {
  var __robofusionDeviceAdapter: DeviceAdapter | undefined;
}
