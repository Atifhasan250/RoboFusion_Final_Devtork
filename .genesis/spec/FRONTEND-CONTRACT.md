# Frontend Contract — for the design teammate

Visual design is free, but the judging information must not be removed.

## One evolving dashboard (Stage 4 onward)
Keep earlier elements visible while adding later ones.

Required widgets/content by the end:
1. Live camera image; keep last successful image if a frame fails.
2. IR sensor reading/connection state.
3. Temperature + humidity/connection state.
4. Presence badge: OCCUPIED / EMPTY / UNKNOWN.
5. Marker badge: RED / BLUE / YELLOW / GREEN / UNKNOWN.
6. Rolling record table/list, newest system containing exactly the current 256 device records when full.
7. Device storage: used/limit + cleared-record counter.
8. Connection state: LIVE / OFFLINE / CATCHING_UP.
9. History search: start time + end time + results/clean empty state.
10. Overall status badge: SAFE / WARNING / DANGER.
11. Trend badge: RISING / STABLE / FALLING — visually separate from status.
12. Current danger alert + dashboard ACK button + acknowledgement log.

## Data integration
- Poll latest server/device data every **1000 ms**. Do not require manual reload.
- History search runs only when user submits a range.
- ACK call includes the current `alertId`; never send “ack latest” without an id.
- UI may disable ACK while a request is in flight, but backend/device correctness cannot depend on this.
- Camera should load directly from `NEXT_PUBLIC_DEVICE_CAMERA_URL` or a value returned by state config.

## Stage 4 device-hosted warning
The polished Next.js page is not a replacement for the device-hosted page demanded in Stage 4. Hardware teammate must still serve a tiny fallback page from ESP32.
