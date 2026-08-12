"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  acknowledgeAlert as acknowledgeRealAlert,
  getAcknowledgements,
  getDeviceRecords,
  getDeviceState,
  getLatestTelemetry,
  searchHistory as searchRealHistory,
} from "@/lib/api-client";
import { DemoSimulator } from "@/lib/demo-simulator";
import type { AcknowledgementResult } from "@/types/alerts";
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
  searchHistory: (from: Date, to: Date) => Promise<TelemetryEvent[]>;
  acknowledgeAlert: (
    alertId: string,
    requestId: string,
  ) => Promise<AcknowledgementResult>;
};

export function useRoboFusionData(
  deviceId: string,
  demoEnabled = false,
): RoboFusionData {
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
  const demoSimulatorRef = useRef<DemoSimulator | null>(null);

  const getDemoSimulator = useCallback(() => {
    demoSimulatorRef.current ??= new DemoSimulator();
    return demoSimulatorRef.current;
  }, []);

  const refresh = useCallback(async () => {
    if (demoEnabled) {
      const snapshot = getDemoSimulator().snapshot();
      stateRef.current = snapshot.state;
      setState(snapshot.state);
      setRecords(snapshot.records);
      setAcknowledgements(snapshot.acknowledgements);
      setDeviceReachable(true);
      setLastSuccessfulDevicePollAt(new Date().toISOString());
      setError(null);
      setIsLoading(false);
      return;
    }
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
  }, [demoEnabled, deviceId, getDemoSimulator]);

  const searchHistory = useCallback(
    async (from: Date, to: Date) => {
      if (demoEnabled) return getDemoSimulator().search(from, to);
      const response = await searchRealHistory(
        deviceId,
        from.toISOString(),
        to.toISOString(),
      );
      return response.items;
    },
    [demoEnabled, deviceId, getDemoSimulator],
  );

  const acknowledgeAlert = useCallback(
    async (alertId: string, requestId: string) => {
      if (demoEnabled) {
        const result = getDemoSimulator().acknowledge(alertId, requestId);
        await refresh();
        return result;
      }
      const result = await acknowledgeRealAlert(alertId, requestId);
      await refresh();
      return result;
    },
    [demoEnabled, getDemoSimulator, refresh],
  );

  useEffect(() => {
    const reset = window.setTimeout(() => {
      demoSimulatorRef.current = demoEnabled ? new DemoSimulator() : null;
      stateRef.current = null;
      setState(null);
      setRecords([]);
      setAcknowledgements([]);
      setError(null);
      setDeviceReachable(false);
      setLastSuccessfulDevicePollAt(null);
      setIsLoading(true);
    }, 0);

    return () => window.clearTimeout(reset);
  }, [demoEnabled]);

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
    searchHistory,
    acknowledgeAlert,
  };
}
