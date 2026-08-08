# ADR 0002 — Stable eventId + seq for catch-up

Status: accepted

## Decision
Every device event has stable `eventId` and ordered `seq`. Mongo has a unique eventId index. Offline retries can be repeated safely.

## Reason
Stage 9 requires every offline event later, in original order, with no duplicates.
