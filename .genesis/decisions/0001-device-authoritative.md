# ADR 0001 — Device remains authoritative for physical/offline behavior

Status: accepted

## Decision
ESP32 firmware is the source of truth for sensor timing, recognition, rolling buffer, on-device storage, alarm output, physical acknowledgement, and power recovery. Next.js mirrors and exposes server-side search/integration.

## Reason
Stages 4, 8, 9, 12, and 13 explicitly require behavior that must survive without a normal Next.js server.
