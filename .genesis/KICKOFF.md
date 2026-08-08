# KICKOFF — paste this into Codex

```text
We have 4 hours. Work as an implementation agent, not as a lecturer.

First inspect the existing Next.js repo and read, in this exact order:
1. AGENTS.md
2. .genesis/spec/SOURCE-OF-TRUTH.md
3. .genesis/spec/ARCHITECTURE.md
4. .genesis/spec/DATA-CONTRACTS.md
5. .genesis/spec/HARDWARE-HANDOFF.md
6. .genesis/spec/FRONTEND-CONTRACT.md
7. .genesis/PLAN.md
8. .genesis/DONE.html
9. .genesis/checkpoints/CURRENT.md

Then inspect package.json and the existing src/app structure. Do not initialize a new Next.js project.

Constraints:
- Next.js App Router + TypeScript.
- Use Next Route Handlers, not a second backend server.
- Use MongoDB native driver + Zod only if they are not already present.
- Do not write ESP32 firmware. Hardware teammate owns it.
- Do not redesign frontend. Frontend teammate owns visuals.
- Do not substitute MongoDB for the required on-device storage.
- Do not substitute Next.js hosting for the required Stage 4 device-hosted fallback page.
- Keep everything simple enough to demo today.

Implement milestones M1→M5 in order. Before each milestone, search the repo for existing code and reuse it. After each milestone run typecheck/lint/tests and show real results. If hardware is unavailable, use the mock-device adapter described in the spec; keep the real device adapter behind the same interface.

Most important correctness rules:
- eventId unique => duplicate catch-up data is ignored, not duplicated.
- seq preserves original device order.
- history query accepts deviceId + from + to and returns only records inside the range.
- alertId scopes acknowledgements; first acknowledgement wins.
- server does not invent sensor/marker/safety values; it mirrors device-authoritative values.
- frontend integration updates every ~1 second without manual page reload.

At the end, give me:
A) files changed,
B) commands/tests run and their real results,
C) exact API routes created,
D) exact env vars needed,
E) hardware teammate integration checklist,
F) any remaining judge-risk item.
```
