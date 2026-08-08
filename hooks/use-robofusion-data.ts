"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getAcknowledgements,
  getDeviceRecords,
  getDeviceState,
  getLatestTelemetry,
} from "@/lib/api-client";
import type { AcknowledgementLogItem } from "@/types/alerts";
import type { DeviceState, TelemetryEvent } from "@/types/telemetry";

export type RoboFusionData = {
  state: DeviceState | null;
  records: TelemetryEvent[];
  acknowledgements: AcknowledgementLogItem[];
  error: string | null;
  deviceReachable: boolean;
  lastSuccessfulDevicePollAt: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

export function useRoboFusionData(deviceId: string): RoboFusionData {
  const [state, setState] = useState<DeviceState | null>(null);
  const [records, setRecords] = useState<TelemetryEvent[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<
    AcknowledgementLogItem[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [deviceReachable, setDeviceReachable] = useState(false);
  const [lastSuccessfulDevicePollAt, setLastSuccessfulDevicePollAt] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const stateRef = useRef<DeviceState | null>(null);

  const refresh = useCallback(async () => {
    if (!deviceId) return;
    const [stateResult, recordsResult, acknowledgementResult] =
      await Promise.allSettled([
        getDeviceState(deviceId),
        getDeviceRecords(deviceId),
        getAcknowledgements(),
      ]);

    if (stateResult.status === "fulfilled") {
      stateRef.current = stateResult.value.state;
      setState(stateResult.value.state);
      setDeviceReachable(true);
      setLastSuccessfulDevicePollAt(new Date().toISOString());
      setError(null);
    } else {
      setDeviceReachable(false);
      setError("Device unreachable; showing last-known values when available.");
      if (!stateRef.current) {
        try {
          const latest = await getLatestTelemetry(deviceId);
          if (latest.item) {
            stateRef.current = latest.item;
            setState(latest.item);
          }
        } catch {
          // MongoDB is only a last-known-value source, never proof of reachability.
        }
      }
    }

    if (recordsResult.status === "fulfilled") {
      setRecords(recordsResult.value.items);
    }
    if (acknowledgementResult.status === "fulfilled") {
      setAcknowledgements(acknowledgementResult.value.items);
    }
    setIsLoading(false);
  }, [deviceId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return {
    state,
    records,
    acknowledgements,
    error,
    deviceReachable,
    lastSuccessfulDevicePollAt,
    isLoading,
    refresh,
  };
}
