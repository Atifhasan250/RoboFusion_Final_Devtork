# Hardware Handoff — send this to the hardware teammate now

The software team is **not writing firmware**, but these are the contracts we need.

## Hardware-owned requirements that software cannot fake
- Stage 1 non-blocking LED + IR schedules.
- Stage 2 independent DHT schedule/failure behavior.
- Stage 3 AP setup page, saved credentials, push-button reset, 10–15 s fallback.
- Stage 4 **device-hosted** fallback dashboard + camera/sensor endpoints.
- Stage 5 presence detection + 1 s stability/debounce + lighting robustness.
- Stage 6 red/blue/yellow/green recognition and true UNKNOWN.
- Stage 7 256-entry rolling buffer, ~2 s update.
- Stage 8 device persistence + displayed 150–180 KB limit + oldest eviction + cleared count.
- Stage 9 offline collection and ordered exactly-once resend protocol.
- Stage 11 physical buzzer/relay and authoritative status/trend.
- Stage 12 physical-button acknowledgement and first-wins logic for same `alertId`.
- Stage 13 persistent/recovered state after power cut.

## Please expose these minimal endpoints from ESP32
Exact paths can change once, but tell software immediately.

1. `GET /api/v1/state`
   - returns latest sensor/presence/marker/status/storage/alert snapshot matching `DATA-CONTRACTS.md`.

2. `GET /api/v1/camera`
   - MJPEG stream or current JPEG/snapshot URL.

3. `GET /api/v1/records?limit=256`
   - current rolling record in chronological order.

4. `POST /api/v1/alerts/{alertId}/ack`
   - body `{requestId, source:"dashboard"}`.
   - device must atomically accept only the first acknowledgement for that alert.

5. Outbound device → Next.js:
   - `POST <NEXT_BASE_URL>/api/telemetry/ingest`
   - send live event or offline batch using stable `eventId` and ascending `seq`.
   - retry after network failure; server will deduplicate.

## IDs/order
- `eventId` must remain the same when an event is retried.
- `seq` must represent original event order.
- `alertId` must be unique per danger episode, not reused for the next alert.

## Timing facts software/UI assumes
- live dashboard snapshot updates about every 1 second.
- combined record created about every 2 seconds.
- DANGER transition is debounced/held about 1–2 seconds.
- Stage 3 unreachable WiFi fallback about 10–15 seconds.
- power recovery target about 20 seconds.

## Integration test together
1. software points `DEVICE_BASE_URL` at ESP32.
2. open state endpoint and compare to Serial Monitor.
3. verify camera URL.
4. disconnect WiFi ~3 min; reconnect; server row count/order must match queued events exactly once.
5. trigger danger; press physical button and dashboard button together; only one ACK recorded.
6. trigger a second danger alert; verify alertId changed and first alert did not get altered.
