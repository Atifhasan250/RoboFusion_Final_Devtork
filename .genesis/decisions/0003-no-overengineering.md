# ADR 0003 — Single Next.js app, native MongoDB, polling

Status: accepted

## Decision
Use Next.js Route Handlers + native MongoDB + Zod and ~1 second polling. No separate backend, queue, Redis, WebSocket platform, or ORM unless already present.

## Reason
Four-hour time limit and no requirement needs those extra systems.
