# RoboFusion Wokwi Behavioral Twin

This simulation implements the deterministic device behavior described in
`.genesis/hardware/WOKWI-SIMULATION-SPEC.md`. It uses one ESP32-S3 DevKitC and
clearly labels camera, IR-fault, and network controls as simulation inputs.

It does **not** claim to reproduce the unidentified supplied ESP32-S3-CAM pinout
or prove real optical recognition. Final GPIOs remain gated by
`.genesis/hardware/BOARD-AND-WIRING-GATE.md`.

## Run

Requirements:

- PlatformIO Core or the PlatformIO VS Code extension;
- Wokwi for VS Code, or Wokwi CLI plus a valid `WOKWI_CLI_TOKEN`.

```powershell
Set-Location hardware/firmware
pio run -e wokwi
Set-Location ../wokwi
wokwi-cli lint
wokwi-cli . --scenario smoke.test.yaml
```

The local device-hosted dashboard is forwarded to `http://localhost:8180` while
the simulator is running through Wokwi's IoT gateway.

Wokwi CLI 0.26.1 currently reports the official
`board-esp32-s3-devkitc-1` type as informationally “undocumented”; the same board
is listed in Wokwi's official ESP32 support guide. Diagram lint has no connection
or invalid-attribute warnings.

## Controls

- DHT22 sliders: Wokwi-supported stand-in for DHT11 climate input.
- `IR obstacle`: clear/triggered.
- `IR connected/fault`: explicit Stage 1 fault scenario.
- `DHT connected/fault`: explicit Stage 2 fault scenario.
- `Camera EMPTY/OCCUPIED`: behavioral presence input with 1-second acceptance.
- Marker bits: `001=RED`, `010=BLUE`, `011=YELLOW`, `100=GREEN`; every other
  value is `UNKNOWN`.
- `Network LIVE/OFFLINE`: logical outage; queued records catch up in order after
  reconnect while the simulator's web server remains reachable for inspection.
- Button: short press acknowledges the current alert; hold at least 5 seconds to
  request simulated credential reset.
- Serial `F`: generate 300 records rapidly and verify the RAM ring stays at 256.

## Implemented evidence

- 100 ms heartbeat toggle independent of 1-second IR and 5-second climate jobs;
- explicit sensor failure messages without stopping other tasks;
- device-hosted page and the four agreed device endpoints;
- scenario-controlled presence/marker state, honestly marked as simulation;
- exact 256-entry circular RAM record;
- compact LittleFS circular record store capped at 170 KiB with persistent
  eviction counter and metadata;
- logical `LIVE → OFFLINE → CATCHING_UP → LIVE` outbox behavior;
- reproducible status thresholds, trend separation, 1.5-second safety debounce,
  relay, and buzzer;
- alert-ID-scoped first-wins acknowledgement shared by HTTP and physical button;
- Preferences/LittleFS recovery metadata.

Real camera accuracy, exact real-board wiring, real sensor disconnection, flash
endurance, electrical drive safety, and complete power-cut recovery still require
the supplied hardware and the verification matrix.
