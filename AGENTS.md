# AGENTS.md — RoboFusion software rules for Codex

You are working on a 4-hour hackathon build. Read `.genesis/spec/SOURCE-OF-TRUTH.md` before editing code.

## Non-negotiable scope
- Existing app: Next.js + TypeScript.
- Backend: Next.js Route Handlers; no separate Express/Nest server.
- Database: MongoDB native driver only if persistence/search mirror is needed.
- Hardware firmware is OUT OF SCOPE. Do not generate ESP32/Arduino code unless the human explicitly asks later.
- UI visual design is owned by another teammate. Do not redesign screens, colors, layout, or components. Build data contracts, API routes, hooks/adapters, and integration points only.
- Keep the solution minimal enough to finish in 4 hours.

## Architecture rules
1. The ESP32/device is authoritative for physical sensor timing, camera recognition, rolling record, on-device storage, alarm outputs, physical-button acknowledgement, and power recovery.
2. The Next.js backend is authoritative for server-side ingestion, idempotent mirroring, time-range history search, and remote dashboard integration.
3. Never pretend MongoDB satisfies the Stage 8 on-device 150–180 KB storage requirement. It does not.
4. Never pretend a laptop-hosted Next.js page satisfies the Stage 4 “hosted directly by the device itself” requirement. It does not.
5. Catch-up ingestion must be exactly-once from the server's perspective using a unique `eventId` and must preserve original device ordering by `seq`.
6. Every write payload is validated with Zod.
7. History search uses an index on `{ deviceId: 1, occurredAt: 1 }` and should return within ~1 second for hackathon-scale data.
8. Alert acknowledgement is keyed by `alertId`. UI disabling is not correctness. The first acknowledgement wins; duplicate/simultaneous attempts must not create two acknowledgements.
9. Do not remove an earlier-stage dashboard feature when adding a later one.
10. Prefer 1-second polling over WebSockets unless the repo already has a realtime transport. The requirement allows refresh every 1–2 seconds.

## Allowed edit zones
Prefer editing only:
- `src/app/api/**`
- `src/lib/**`
- `src/models/**` or `src/server/**` if those already exist
- `src/types/**`
- `src/hooks/**` for integration hooks only
- `tests/**`, `__tests__/**`, `scripts/**`
- `.env.example`, package scripts if needed

Avoid touching frontend-owned visual files unless necessary for a tiny integration seam.

## Quality gate after every milestone
Run the repo's real commands. At minimum:
```bash
npx tsc --noEmit
npm run lint
npm test -- --run
```
If a script does not exist, inspect `package.json` and use the closest existing command; do not invent passing output.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
