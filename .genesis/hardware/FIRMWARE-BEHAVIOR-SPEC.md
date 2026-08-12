# Firmware Behavior Specification

## Ownership and architecture

The ESP32-S3-CAM is authoritative for sensor timing, camera processing, the
256-entry rolling record, device storage, offline operation, status/trend,
physical outputs, acknowledgement arbitration, Wi-Fi memory, and recovery. The
Next.js/MongoDB system is a remote dashboard and searchable mirror.

Use one non-blocking event loop (or small RTOS tasks with explicit ownership).
No normal path may use a long blocking delay. Network, camera, and storage work
must be bounded so the heartbeat and sensors retain their schedules.

## Timing constants

| Behavior | Target |
|---|---:|
| Heartbeat toggle | 100 ms (100 ms on, 100 ms off) |
| IR sample/report | 1,000 ms |
| DHT11 sample/report | 5,000 ms |
| Presence accepted-state hold | 1,000 ms |
| Combined record | 2,000 ms |
| Dashboard state refresh | 1,000 ms |
| Safety state hold/debounce | 1,500 ms |
| Unreachable saved Wi-Fi attempt | 10–15 s total |
| Wi-Fi reset long press | 5,000 ms |
| Recovery readiness target | under 20 s |

All scheduling uses elapsed-time comparisons, not chained `delay()` calls.
Timestamp wraparound-safe comparisons are required.

## Device state machines

### Network

`BOOT → TRY_SAVED → LIVE`, or `BOOT/TRY_SAVED → SETUP_AP`. A connected device
may transition `LIVE → OFFLINE → CATCHING_UP → LIVE`. Setup mode serves only the
Wi-Fi-name, password, and device-name form. It is separate from the main Stage 4
dashboard.

Credentials and device name are stored in NVS. An unreachable saved network is
tried for only 10–15 seconds before setup AP starts. A successful save connects
without a power cycle. A 5-second button hold clears all three saved values and
returns to setup mode.

### Alert

`NONE → OPEN → ACKNOWLEDGED → RESOLVED`. Each Danger episode creates a new
`alertId`; it is never reused. Physical and HTTP acknowledgements enter one
serialized arbitration function guarded by a critical section/mutex:

1. compare the requested `alertId` with the current alert;
2. if state is `OPEN`, atomically write winner source, request ID, and time;
3. persist that result before returning success;
4. every later request returns the same final state with `accepted:false`.

This first-wins rule is correctness; disabling a web button is only UX.

## Stage implementation chain

### Stages 1–2: independent sensing

- Heartbeat, IR, and DHT each have independent deadlines.
- IR has an explicit `connected`/fault state. Because many simple IR modules
  cannot prove disconnection from a single static digital level, the final build
  must document the actual detection method (diagnostic pin/analog behavior,
  plausibility timeout, or a demonstrated module-specific method). Do not claim
  disconnect detection until it works on the supplied module.
- DHT timeout/checksum/NaN is a fault, not a numeric reading. Last-good values may
  remain internally tagged as stale, but Serial and APIs must expose `connected:false`.
- A sensor fault never stops the heartbeat or the other sensor.

### Stage 3: provisioning

Run a temporary setup AP and device-hosted setup page when no credentials exist or
saved Wi-Fi cannot be reached in the required window. Never bake a private SSID or
password into the final firmware. The Wokwi-only `Wokwi-GUEST` profile is a build
adapter, not the real-device provisioning solution.

### Stage 4: device-hosted dashboard

The ESP32 serves a compact dashboard itself, including camera, IR, temperature,
and humidity. JSON state updates about once per second without reloading the page.
The camera element keeps the last successfully decoded frame when a new frame
fails. The hosted Next.js site does not replace this endpoint.

Required device endpoints remain those in `../spec/HARDWARE-HANDOFF.md`:

- `GET /api/v1/state`
- `GET /api/v1/camera`
- `GET /api/v1/records?limit=256`
- `POST /api/v1/alerts/{alertId}/ack`

### Stage 5: presence

Use camera frames, not the IR sensor, as the Stage 5 decision source. A practical
embedded pipeline is a low-resolution grayscale frame, illumination normalization,
background/region difference, noise cleanup, and a minimum changed-area threshold.
Only commit `OCCUPIED` or `EMPTY` after the candidate remains unchanged for 1
second. Re-baseline slowly when empty so a global lighting shift does not look like
an entering object. Record confidence/diagnostic values during calibration.

### Stage 6: marker recognition

Calibrate the four supplied cards under the demonstration lighting. In a central
region of interest, reject low-saturation, too-dark, too-bright, or too-small color
areas, then classify using calibrated HSV ranges/centroids. Require a minimum
confidence and margin from the second-best class; otherwise output `UNKNOWN`.
Validate on a shuffled 10-card known set plus at least two unseen colors. The
question requires behavior, not a specific ML library.

### Stage 7: rolling record

Every 2 seconds, snapshot the latest IR, climate, accepted presence, marker,
overall status, trend, connection state, storage state, and alert state into one
record. Store records in a fixed-capacity circular buffer of 256. Maintain count
and head index; never shift an unbounded array. API output is chronological oldest
to newest and contains no blank slots.

### Stage 8: persistent storage

Use the device's flash filesystem or a bounded flash partition. Freeze the visible
limit at **170 KiB (174,080 bytes)**, which is inside the requested 150–180 KB
range. Use a compact versioned record format with checksum and append/segment
metadata. Before a write would exceed the limit, evict complete oldest records or
segments and increment a persistent `clearedRecords` counter by the exact number
removed.

Recovery scans/repairs only the bounded log, ignores an incomplete final write,
and never grows beyond the displayed limit. MongoDB is not part of this limit.

### Stage 9: offline and catch-up

Each record gets a stable `eventId` and monotonic `seq` when created, before any
send attempt. Retries reuse both. Persist enough sequence/boot-generation state to
avoid ID reuse after reset. Offline records stay in an ordered outbox. On reconnect:

1. enter `CATCHING_UP`;
2. send bounded batches in ascending `seq`;
3. remove/mark a batch only after a valid successful server response;
4. retry ambiguous failures with the same IDs;
5. enter `LIVE` only when the outbox is empty.

The server's unique `eventId` makes retries exactly-once from its perspective.

### Stage 10: history

The device sends live and catch-up events to the Next.js ingest route. MongoDB is
the indexed search mirror. The device retains Stage 8 storage regardless of server
availability.

### Stage 11: status, trend, and outputs

Use a reproducible baseline that can be tuned after real DHT11 calibration:

- `SAFE`: temperature below 30 °C and humidity below 70%;
- `WARNING`: temperature 30–34.9 °C or humidity 70–84.9%;
- `DANGER`: temperature at least 35 °C or humidity at least 85%.

Take the maximum temperature/humidity severity. Presence and marker remain part of
the combined record but do not imply physical danger without a stated domain rule.
Commit a candidate status only after it remains stable for 1.5 seconds. `DANGER`
activates relay and buzzer; other statuses do not.

Compute trend separately from a recent window of valid climate readings using a
documented normalized risk score. Compare the mean of the newest portion with the
oldest portion and apply a dead band to produce `RISING`, `STABLE`, or `FALLING`.
Trend alone must never write to relay/buzzer outputs.

If both climate readings are unavailable, expose status as unavailable internally
and keep the alarm fail-safe policy explicit; do not silently invent safe readings.
The public JSON contract may need an agreed `UNKNOWN` extension before firmware
integration if this state must cross the API.

### Stage 12: two simultaneous actions

Both the physical short press and dashboard POST call the same alert arbitration
function. Store a separate acknowledgement log entry for each alert ID. Test the
same alert with concurrent sources and then two distinct alerts close together.

### Stage 13: recovery

Persist credentials, device name, record/outbox metadata, monotonic ID state,
storage-clear count, and alert/ack state using atomic replace or journaled metadata.
Outputs boot inactive until recovered state is validated, then reflect the
authoritative state. Run two complete 10-second power-off cycles; device dashboard
and physical outputs must agree within 20 seconds after each restore.

## Firmware module boundaries

- `scheduler`: deadlines and watchdog-friendly execution;
- `sensors`: IR/DHT sampling, validation, stale/fault state;
- `vision`: camera acquisition, presence, marker, last-good frame;
- `records`: 256-entry RAM ring;
- `storage`: bounded persistent log, outbox, recovery, cleared counter;
- `network`: setup AP, NVS credentials, reconnect, catch-up;
- `web`: setup page, device dashboard, JSON/camera/ACK endpoints;
- `safety`: status debounce, trend, alert lifecycle;
- `outputs`: heartbeat, relay, buzzer, button interpretation;
- `protocol`: stable IDs and JSON contract shared with Next.js.

