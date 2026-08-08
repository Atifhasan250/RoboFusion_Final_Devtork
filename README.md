# RoboFusion Monitor

Next.js App Router dashboard and API mirror for the RoboFusion ESP32-S3-CAM safety monitor. The device remains authoritative for sensors, markers, safety state, alerts, the 256-record rolling buffer, and the required on-device persistent storage. MongoDB stores a deduplicated software mirror; it does not replace device storage. The separate Stage 4 fallback page must be hosted by the ESP32 firmware.

## Run locally

```bash
bun install
Copy-Item .env.example .env.local
bun run dev
```

Open `http://localhost:3000`. Verification commands:

```bash
bun run typecheck
bun run lint
bun run test -- --run
```

## Environment

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=robofusion
DEVICE_BASE_URL=http://192.168.4.1
DEVICE_ADAPTER=real
DEVICE_REQUEST_TIMEOUT_MS=2000
NEXT_PUBLIC_DEVICE_CAMERA_URL=http://192.168.4.1/api/v1/camera
NEXT_PUBLIC_DEVICE_ID=rf-01
```

Use `DEVICE_ADAPTER=mock` and `NEXT_PUBLIC_DEVICE_ID=mock-device` only when hardware is unavailable. Mock values still flow through the same device routes and typed client as real hardware; the frontend has no separate fake-data branch. Restart the dev server after changing public environment variables.

## API routes

- `POST /api/telemetry/ingest` — one event or ordered catch-up batch; stable `eventId` values are deduplicated.
- `GET /api/telemetry/latest?deviceId=...` — latest mirrored telemetry.
- `GET /api/history?deviceId=...&from=...&to=...` — inclusive saved-history range, oldest first.
- `GET /api/devices/{deviceId}/state` — validated device-authoritative state.
- `GET /api/devices/{deviceId}/records?limit=256` — validated device rolling records.
- `POST /api/alerts/{alertId}/ack` — forwards a scoped dashboard acknowledgement; device decides the first winner.
- `GET /api/alerts?limit=100` — persisted dashboard and physical acknowledgement log.

The dashboard polls about once per second. A failed direct device-state request is shown as `OFFLINE`; MongoDB last-known values never make the device appear reachable. A physical acknowledgement returned by device state is mirrored to the alert log after the state response.

## Team boundary

- Hardware teammate: firmware schedules, AP/setup fallback, device-hosted page, camera/state/records/ACK endpoints, on-device storage and eviction, offline queue/replay, physical outputs/button, and power recovery.
- Software: Next.js routes, validation, MongoDB mirror/indexes, history, alert log, polling integration, and truthful offline/last-known UI.

See [START-HERE.md](START-HERE.md), [.genesis/spec/HARDWARE-HANDOFF.md](.genesis/spec/HARDWARE-HANDOFF.md), and [.genesis/spec/JUDGE-DEMO-CHECKLIST.md](.genesis/spec/JUDGE-DEMO-CHECKLIST.md).
