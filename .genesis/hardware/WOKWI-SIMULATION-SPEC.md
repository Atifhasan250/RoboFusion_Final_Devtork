# Wokwi Simulation Specification

## Goal

Create a portfolio-friendly behavioral twin that runs one ESP32-S3 simulation and
demonstrates the timing, state machines, rolling storage logic, offline catch-up,
alarm outputs, and acknowledgement arbitration used by the real project.

It must be labeled **Simulation**. It is not a substitute for real optical or
electrical evidence.

## Supported target and honest substitutions

Wokwi's documented ESP32-S3 target is the `ESP32-S3-DevKitC-1`, not the unknown
supplied ESP32-S3-CAM revision. The simulation therefore uses logical GPIOs that
are separate from the final real-board map.

| Supplied hardware/behavior | Wokwi representation | Claim allowed |
|---|---|---|
| ESP32-S3-CAM | ESP32-S3-DevKitC-1 | ESP32-S3 firmware behavior, not exact PCB pinout |
| DHT11 | Wokwi DHT22 control | Temperature/humidity timing and safety logic, not DHT11 electrical fidelity |
| IR obstacle sensor | Interactive digital switch/custom scenario control | IR state/fault behavior, not real optical range |
| Camera presence | Scenario control/custom camera-source adapter | Presence debounce/state pipeline, not real image detection |
| Four color cards + unknown | Five marker scenario controls | Class/UNKNOWN handling, not camera accuracy |
| Relay | Wokwi relay module | Danger relay state |
| Buzzer | Wokwi buzzer | Danger audible state |
| Momentary button | Wokwi pushbutton with bounce enabled | ACK, debounce, and long-press behavior |
| Indicator LED | Wokwi LED | Non-blocking 5 Hz heartbeat |
| Device storage/power loss | Bounded storage adapter plus scripted reset scenario | Storage/recovery logic; real flash/power test still required |
| Wi-Fi outage | Simulation command/scenario flag | Offline ordering and catch-up state machine |

The standard simulation must not hardcode a known card class when the UNKNOWN
scenario is selected. The displayed source must say `SIMULATED_CAMERA` so a
portfolio viewer cannot confuse it with optical inference.

## Planned repository layout

When implementation begins, add (outside `.genesis`):

```text
hardware/
  firmware/
    platformio.ini
    src/
    include/
  wokwi/
    diagram.json
    wokwi.toml
    scenario.yaml
    README.md
  docs/
    wiring-real.md
    evidence/
```

The core firmware modules should be shared. Only the hardware abstraction changes:

- `RealHardware`: real camera, DHT11, IR module, flash, and final GPIO map;
- `WokwiHardware`: interactive DHT22 and scenario controls;
- both publish the same `TelemetryEvent` JSON and run the same record, storage,
  network, safety, alert, and scheduling logic.

## Simulation controls

Expose simple, clearly labeled controls or serial commands:

| Control | Values |
|---|---|
| IR | `CONNECTED_EMPTY`, `CONNECTED_TRIGGERED`, `DISCONNECTED` |
| Climate | interactive temperature and humidity |
| Presence scenario | `EMPTY`, `OCCUPIED`, `LIGHTING_ONLY`, `FLICKER` |
| Marker scenario | `RED`, `BLUE`, `YELLOW`, `GREEN`, `UNKNOWN` |
| Network | `LIVE`, `DROP`, `RESTORE` |
| Alert race | `PHYSICAL_FIRST`, `DASHBOARD_FIRST`, `SIMULTANEOUS` |
| Storage | normal rate or accelerated fill |
| Recovery | simulated reset after state is persisted |

Every scenario transition prints a structured serial line with simulation time,
sequence, accepted state, and reason. Acceleration may be used for the 300-record
and storage-fill tests, but the normal timing profile remains the default.

## Required scripted demo

1. Start with heartbeat, IR every 1 second, and climate every 5 seconds.
2. Toggle IR repeatedly; heartbeat remains 100 ms on/off.
3. Select IR/DHT fault; show explicit fault while other tasks continue.
4. Show the device dashboard/state endpoint updating every second.
5. Run presence flicker and lighting-only scenarios; accepted state does not flip.
6. Cycle Red, Blue, Yellow, Green, and Unknown marker states.
7. Accelerate to 300 combined records; exactly the newest 256 remain in order.
8. Fill the 170 KiB store twice; it never exceeds the limit and cleared count rises.
9. Drop network for the equivalent of 3 minutes, restore, and show ordered,
   duplicate-safe catch-up.
10. Search the mirrored time range from the Next.js dashboard.
11. Move climate toward Danger, then cross it; trend changes before the alarm.
12. Race physical and dashboard ACK for one `alertId`; exactly one wins. Repeat
    with a new alert ID.
13. Reset twice after persistence; recovered state is consistent each time.

## Wokwi networking notes

The simulator's `Wokwi-GUEST` network may be used only by the simulation adapter.
For local integration, Wokwi's IoT gateway/port forwarding can expose an ESP32 web
server or allow the simulated device to call the local/hosted Next.js ingest URL.
The real firmware still implements Stage 3 setup AP and saved credentials.

## Acceptance rule

A green Wokwi demo means the deterministic firmware logic and software contract
are reproducible. The following still need the supplied physical board:

- exact wiring and GPIO compatibility;
- DHT11 and IR disconnection behavior;
- real camera stream, presence robustness, and 9/10 marker test;
- genuine device flash endurance/persistence and complete power removal;
- real relay/buzzer electrical behavior;
- recovery within 20 seconds on the assembled device.

