import type {
  AcknowledgementRequest,
  AcknowledgementResult,
} from "@/types/alerts";
import type { DeviceState, TelemetryEvent } from "@/types/telemetry";

export interface DeviceAdapter {
  getState(): Promise<DeviceState>;
  getRecords(limit?: number): Promise<TelemetryEvent[]>;
  acknowledgeAlert(
    alertId: string,
    request: AcknowledgementRequest,
  ): Promise<AcknowledgementResult>;
}
