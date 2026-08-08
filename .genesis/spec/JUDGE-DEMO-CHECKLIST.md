# Judge demo checklist — software + hardware integration

This checklist verifies the software mirror without claiming that MongoDB is
Stage 8 device storage or that Next.js is the Stage 4 device-hosted page.

## Before the demo

- Set `MONGODB_URI`, `MONGODB_DB`, `DEVICE_BASE_URL`, and
  `NEXT_PUBLIC_DEVICE_CAMERA_URL`.
- Set `DEVICE_ADAPTER=real`; use `mock` only while the ESP32 is unavailable.
- Confirm the ESP32 exposes the four endpoints in `HARDWARE-HANDOFF.md`.
- Run `bun run typecheck`, `bun run lint`, and `bun run test -- --run`.

## Ordered proof

1. POST one event, then the same event again to `/api/telemetry/ingest`.
   Confirm the second response reports one duplicate and Mongo has one row.
2. POST an ascending catch-up batch, retry it, and confirm its stored `seq`
   order is unchanged with no duplicate rows.
3. Query `/api/history` with before/inside/after fixtures. Confirm only inclusive
   in-range events are returned oldest to newest; an old empty range returns
   `{ "items": [], "count": 0 }`.
4. Set the dashboard to poll the typed hook every second and compare the state
   values with the ESP32 Serial Monitor. Confirm camera failure retains the last
   successful frame in the frontend component.
5. Trigger one Danger episode. Send two dashboard ACK requests while pressing
   the physical button; confirm the device accepts exactly one and Mongo has one
   document for that `alertId`.
6. Trigger another Danger episode and confirm it has a new `alertId` and remains
   independent.
7. Disconnect WiFi for about three minutes, reconnect, and confirm queued events
   arrive exactly once in original `seq` order while the device shows
   `OFFLINE → CATCHING_UP → LIVE`.
8. Power-cycle twice. Confirm the device-hosted page, device storage, alarm state,
   and physical outputs recover within the Stage 13 target.
