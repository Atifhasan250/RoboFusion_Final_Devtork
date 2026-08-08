import type {
  AcknowledgementLogItem,
  AcknowledgementResult,
} from "@/types/alerts";
import type { DeviceState, TelemetryEvent } from "@/types/telemetry";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`RoboFusion API request failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getLatestTelemetry(deviceId: string) {
  return getJson<{ item: TelemetryEvent | null }>(
    `/api/telemetry/latest?deviceId=${encodeURIComponent(deviceId)}`,
  );
}

export function getDeviceState(deviceId: string) {
  return getJson<{ state: DeviceState }>(
    `/api/devices/${encodeURIComponent(deviceId)}/state`,
  );
}

export function getDeviceRecords(deviceId: string, limit = 256) {
  return getJson<{ items: TelemetryEvent[]; count: number }>(
    `/api/devices/${encodeURIComponent(deviceId)}/records?limit=${limit}`,
  );
}

export function searchHistory(deviceId: string, from: string, to: string) {
  const query = new URLSearchParams({ deviceId, from, to });
  return getJson<{ items: TelemetryEvent[]; count: number }>(
    `/api/history?${query}`,
  );
}

export function acknowledgeAlert(alertId: string, requestId: string) {
  return getJson<AcknowledgementResult>(
    `/api/alerts/${encodeURIComponent(alertId)}/ack`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, source: "dashboard" }),
    },
  );
}

export function getAcknowledgements(limit = 100) {
  return getJson<{ items: AcknowledgementLogItem[]; count: number }>(
    `/api/alerts?limit=${limit}`,
  );
}

export const deviceCameraUrl =
  process.env.NEXT_PUBLIC_DEVICE_CAMERA_URL ?? null;
