# RoboFusion Hardware Workstream

This directory is the add-only hardware plan for the RoboFusion build. It turns
the 20-page question paper into an implementable firmware, wiring, simulation,
and verification plan without changing the existing Genesis documents.

## Read in this order

1. `BOARD-AND-WIRING-GATE.md` — identify the supplied board before assigning GPIOs.
2. `FIRMWARE-BEHAVIOR-SPEC.md` — device-owned behavior for all 13 stages.
3. `WOKWI-SIMULATION-SPEC.md` — the portfolio simulation and its honest limits.
4. `HARDWARE-VERIFICATION-MATRIX.md` — evidence required before calling a stage complete.

The existing `../spec/SOURCE-OF-TRUTH.md` remains authoritative if any summary
here conflicts with the photographed problem statement.

## Current status

- The required parts and stage behaviors are known.
- The software-to-device JSON contract already exists in
  `../spec/DATA-CONTRACTS.md`.
- Exact physical GPIO assignments are intentionally **not frozen** because the
  question paper gives only the generic name `ESP32-S3-CAM`, not its exact
  manufacturer/model or camera pin map.
- Wokwi can be a useful behavioral twin, but it cannot honestly replace the
  real-board camera, DHT11, IR-disconnect, power-cut, or electrical tests.

## Definition of done for the hardware workstream

- The real board has been identified from front/back photos and its vendor pinout.
- A reviewed pin map and wiring diagram exist for that exact board.
- One firmware image implements the complete cumulative Stage 1–13 behavior.
- A Wokwi project demonstrates the deterministic logic and integration contract.
- Real-device evidence covers every item that Wokwi can only emulate.

