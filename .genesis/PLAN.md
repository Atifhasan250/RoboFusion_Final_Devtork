# PLAN — RoboFusion Software Track

Hackathon mode: minimal, testable, no overengineering. The hardware firmware and visual design are separate teammate-owned tracks.

## Chosen approach
**Device-authoritative + Next.js mirror.** The ESP32 owns anything that must still work while WiFi/server is gone; Next.js owns durable server ingestion/search and the polished browser experience. This is the smallest architecture that respects Stages 4, 8, 9, 12, and 13 without pretending a cloud database is the device.

## Rejected approaches
- **All logic in Next.js:** rejected because sensor timing, offline operation, physical alarm/ack, on-device storage, and power recovery must survive without the server.
- **All logic on ESP32 only:** rejected because the team specifically needs a Next.js app/backend and Stage 10 benefits from indexed searchable history.
- **Microservices / queue / Redis:** rejected as unnecessary for a four-hour prototype.

## M1 — Domain contracts + Mongo connection
- Outcome: shared Zod schemas/types, Mongo connection helper, indexes, and environment validation.
- Files: `src/lib/**`, `src/types/**`, database helper/model area, tests.
- Must include: TelemetryEvent, DeviceState, Alert/Acknowledgement contracts.
- Indexes: unique `eventId`; compound `{deviceId:1, occurredAt:1}`; optional `{deviceId:1, seq:1}`.
- Demo: run unit tests for schema validation + index setup and `npx tsc --noEmit`.

## M2 — Exactly-once ingest + latest state
- Outcome: `POST /api/telemetry/ingest` accepts one event or ordered batch and ignores duplicates safely; `GET /api/telemetry/latest` returns latest state.
- Must preserve `seq`; never silently reorder a catch-up batch.
- Response should make duplicates visible, e.g. `{accepted, duplicates, lastSeq}`.
- Demo: send the same batch twice; database row count must not double.

## M3 — Searchable history
- Outcome: `GET /api/history?deviceId=...&from=...&to=...` validates the range, returns only matching records sorted oldest→newest, and returns `[]` with a clean response for no results.
- Use the compound time index.
- Demo: seed before/inside/after records; query returns only inside records.

## M4 — Device state + alert acknowledgement integration
- Outcome: API/client contract for live device state and dashboard ACK.
- Preferred route: `POST /api/alerts/[alertId]/ack` with `{requestId, source:"dashboard"}`.
- Correctness: `alertId` prevents one alert from acknowledging another; first acknowledgement wins. The device remains authoritative because the physical button lives there.
- Backend mirrors/records the device result atomically; duplicate ACK attempts do not create duplicate acknowledgement records.
- Demo: two concurrent requests for same alert => exactly one winning acknowledgement; second alert remains independent.

## M5 — Frontend data seam + mock device + judge tests
- Outcome: frontend teammate gets a tiny typed client/hook layer; hardware can be absent during software development.
- Poll latest state every 1000 ms; do not redesign UI.
- Add a mock-device/dev data path that produces realistic events/statuses without pretending it is hardware.
- Add tests/scripts for duplicate ingest, history range, concurrent ACK, and offline catch-up order.
- Produce `.genesis/spec/JUDGE-DEMO-CHECKLIST.md`-compatible demo steps.

## Timebox
- 0:00–0:20 read spec + inspect repo + install only needed deps.
- 0:20–1:15 M1 + M2.
- 1:15–1:50 M3.
- 1:50–2:30 M4.
- 2:30–3:10 M5 + frontend seam.
- 3:10–3:35 integrate real hardware endpoints.
- 3:35–3:50 run judge checklist + fix only blockers.
- 3:50–4:00 documentation/demo prep.

## Stop conditions
If a fancy feature threatens the timeline, drop it unless it is explicitly in the problem statement. No auth system, charts library, websockets, background job platform, ORM migration framework, or multi-tenant device management unless already present.
