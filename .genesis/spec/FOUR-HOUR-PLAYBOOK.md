# Four-hour playbook — simple version

## First 10 minutes
- Copy this Genesis into repo.
- Software person sends `HARDWARE-HANDOFF.md` to hardware teammate.
- Frontend person gets `FRONTEND-CONTRACT.md`.
- Everyone agrees one `deviceId`, endpoint names, and Stage 11 thresholds.

## Software priority order
1. Schemas + Mongo.
2. Idempotent ingest.
3. History search.
4. Alert ACK endpoint/client.
5. Frontend typed hooks/client.
6. Mock device + tests.
7. Real hardware integration.

## If time becomes short
Never sacrifice these backend correctness items:
- duplicate-safe catch-up,
- history range correctness,
- alertId-scoped first-wins ACK,
- clean device timeout/error,
- 1-second dashboard refresh seam.

Drop these first if they are not already present:
- charts,
- auth,
- animations,
- WebSockets,
- admin pages,
- fancy ORM,
- deployment automation.
