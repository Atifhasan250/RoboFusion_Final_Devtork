"use client";

import { useCallback, useEffect, useState } from "react";

import { getDeviceRecords, getDeviceState } from "@/lib/api-client";
import type { DeviceState, TelemetryEvent } from "@/types/telemetry";

export type RoboFusionData = {
  state: DeviceState | null;
  records: TelemetryEvent[];
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

export function useRoboFusionData(deviceId: string): RoboFusionData {
  const [state, setState] = useState<DeviceState | null>(null);
  const [records, setRecords] = useState<TelemetryEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!deviceId) return;
    try {
      const [stateResult, recordsResult] = await Promise.all([
        getDeviceState(deviceId),
        getDeviceRecords(deviceId),
      ]);
      setState(stateResult.state);
      setRecords(recordsResult.items);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Device unavailable",
      );
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { state, records, error, isLoading, refresh };
}
