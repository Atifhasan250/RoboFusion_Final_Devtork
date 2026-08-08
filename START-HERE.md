# RoboFusion Hackathon — Start Here

This is a **drop-in Genesis source-of-truth** for an already-initialized Next.js app.

## Do this first
1. Copy **`AGENTS.md`** and the **`.genesis/`** folder into the root of your existing Next.js project.
2. Do **not** copy any firmware into this project. Firmware/hardware is owned by the hardware teammate.
3. Open Codex in the Next.js repo.
4. Paste the prompt from `.genesis/KICKOFF.md`.
5. Tell the frontend teammate to read `.genesis/spec/FRONTEND-CONTRACT.md` before wiring their design.
6. Tell the hardware teammate to read `.genesis/spec/HARDWARE-HANDOFF.md` immediately; it contains the API/event contract the software depends on.

## Recommended minimal dependencies
Use the existing Next.js/TypeScript stack. Add only what is actually needed:

```bash
npm i mongodb zod
npm i -D vitest
```

Do not add Redis, Kafka, Socket.IO, Prisma, Mongoose, a separate Express server, or a second frontend unless the existing repo already requires them.

## Environment
Create `.env.local` from `.genesis/spec/ENVIRONMENT.md`.

## The one architecture warning you must remember
The problem statement explicitly requires the **Stage 4 dashboard to be hosted directly by the device itself**. A normal Next.js app running on a laptop/server does **not** satisfy that line by itself. Therefore:
- Main polished dashboard: Next.js (your software/frontend team).
- Judge-safe Stage 4 fallback: tiny static dashboard served by the ESP32 firmware, owned by the hardware teammate, using the same JSON contract.

Do not replace the device-hosted requirement with MongoDB or Next.js.
