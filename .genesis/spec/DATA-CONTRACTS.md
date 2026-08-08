# Data Contracts

These are the software ↔ hardware contracts. Keep field names stable once the hardware teammate starts integration.

## 1) TelemetryEvent

```ts
type TelemetryEvent = {
  eventId: string;          // globally unique, stable across retry
  deviceId: string;
  seq: number;              // monotonically increasing event order
  occurredAt: string;       // ISO timestamp generated/estimated by device
  source: "live" | "catchup";

  ir: {
    connected: boolean;
    occupiedRaw?: boolean;
  };
  climate: {
    connected: boolean;
    temperatureC?: number;
    humidityPct?: number;
  };
  presence: "OCCUPIED" | "EMPTY" | "UNKNOWN";
  marker: "RED" | "BLUE" | "YELLOW" | "GREEN" | "UNKNOWN";
  overallStatus: "SAFE" | "WARNING" | "DANGER";
  trend: "RISING" | "STABLE" | "FALLING";
  connectionState: "LIVE" | "OFFLINE" | "CATCHING_UP";

  storage?: {
    limitBytes: number;     // target 150–180 KB on device
    usedBytes: number;
    clearedRecords: number;
  };

  alert?: {
    alertId: string;
    state: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
    acknowledgedBy?: "physical" | "dashboard";
    acknowledgedAt?: string;
  };
};
```

## 2) Ingest request
Single:
```json
{"event": {"eventId":"rf-01-1001","deviceId":"rf-01","seq":1001,"occurredAt":"2026-08-08T05:50:00.000Z","source":"live"}}
```
Batch catch-up:
```json
{"events":[{"eventId":"rf-01-1001","seq":1001},{"eventId":"rf-01-1002","seq":1002}]}
```
Server validates full schema in real code. Batch must already be in ascending seq; reject malformed/reversed batch rather than silently sorting unless the team explicitly chooses and documents sorting.

Suggested response:
```json
{"accepted":2,"duplicates":0,"lastSeq":1002}
```

## 3) History query
`GET /api/history?deviceId=rf-01&from=<ISO>&to=<ISO>`

Response:
```json
{"items":[],"count":0}
```
No matches is HTTP 200 with empty items, not an error.

## 4) Alert acknowledgement
Request from browser to Next.js:
```json
{"requestId":"uuid-or-random-id","source":"dashboard"}
```
Next.js forwards to the current device with the **path alertId**. Device must answer whether this request won or the alert was already acknowledged.

Suggested response:
```json
{
  "alertId":"alert-42",
  "accepted":true,
  "acknowledgedBy":"dashboard",
  "acknowledgedAt":"2026-08-08T05:51:01.000Z"
}
```
A simultaneous loser returns the same final alert state with `accepted:false`; it must not create a second acknowledgement.

## Mongo collections
### `telemetry_events`
Indexes:
- unique `{eventId:1}`
- `{deviceId:1, occurredAt:1}`
- optional unique `{deviceId:1, seq:1}` if seq never resets for that device

### `alerts`
Fields: alertId, deviceId, openedAt, state, acknowledgedBy, acknowledgedAt, winningRequestId.
Unique `{alertId:1}`.

### Optional `device_state`
One document/device for latest snapshot/connection display. Can also derive latest from telemetry if time is short.
