# RoboFusion Safety Monitor

RoboFusion is an ESP32-S3-CAM safety-monitoring system with a device-authoritative firmware design, a Next.js dashboard, a MongoDB telemetry mirror, and a repository-local Wokwi behavioural twin. It follows the supplied 13-stage challenge brief: sensing, marker and presence state, safety classification, local outputs, acknowledgement, a 256-record rolling buffer, 170 KiB persistent device storage, offline catch-up, history, and fault visibility.

The project is designed to remain useful in three different environments:

- **Portfolio demo:** click **Simulate Demo** in the dashboard. It runs entirely in the browser, needs no database or hardware, and immediately supplies deterministic telemetry, alerts, history, storage usage, camera-placeholder state, connectivity transitions, and acknowledgement data.
- **Wokwi behavioural twin:** compile and run the ESP32-S3 simulation under [`hardware/wokwi`](hardware/wokwi). It exercises the firmware timing, safety, storage, outputs, acknowledgement, connectivity, and HTTP contracts without pretending to prove real camera optics or electrical wiring.
- **Real hardware:** configure the documented device adapter after the exact supplied board revision and pinout have passed the hardware gate.

## What the dashboard demonstrates

- live temperature and humidity with SAFE / WARNING / DANGER state
- marker, presence, trend, relay, buzzer, storage, and connection state
- exact 256-record device buffer display
- inclusive historical range search
- first-wins alert acknowledgement and acknowledgement log
- explicit offline and catching-up states
- a clearly labelled simulated camera scene in demo mode

Demo mode is intentionally separate from the real adapter. It never writes to MongoDB, never contacts a LAN device, and never presents generated values as hardware evidence. Selecting **Exit Demo** returns to the configured real-device path.

## Architecture

```text
Real ESP32 / Wokwi twin
  ├─ sensors, state machine, local outputs, ACK arbitration
  ├─ 256-record RAM ring + 170 KiB LittleFS circular store
  └─ state / records / camera / alert-ACK HTTP endpoints
                    │
                    ▼
Next.js API mirror ────── MongoDB (deduplicated telemetry + ACK log)
                    │
                    ▼
Next.js dashboard  ◄──── browser-only portfolio demo simulator
```

The device is the source of truth for reachability, safety, records, outputs, and the winning acknowledgement. MongoDB is a searchable, deduplicated mirror; cached database values never make an unreachable device appear online.

## Run locally

Prerequisites: Node.js 20+ and Bun 1.3+ (or a compatible npm install).

```bash
bun install
Copy-Item .env.example .env.local
bun run dev
```

Open `http://localhost:3000` and select **Simulate Demo**. No environment variables are needed for that mode. The copied defaults are only for the real-device path.

Verification commands:

```bash
bun run typecheck
bun run lint
bun run test -- --run
```

## Real-device configuration

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=robofusion
DEVICE_BASE_URL=http://192.168.4.1
DEVICE_ADAPTER=real
DEVICE_REQUEST_TIMEOUT_MS=2000
NEXT_PUBLIC_DEVICE_CAMERA_URL=http://192.168.4.1/api/v1/camera
NEXT_PUBLIC_DEVICE_ID=rf-01
```

`DEVICE_ADAPTER=mock` remains available for API integration work; the visible **Simulate Demo** mode is the recommended portfolio path. Restart the dev server after changing any `NEXT_PUBLIC_*` value.

## Run the Wokwi behavioural twin

The simulator uses an ESP32-S3 DevKitC-1 as a logical stand-in, a DHT22 as Wokwi's controllable temperature/humidity stand-in, and switches for IR, presence, marker, network, and fault scenarios. These simulated GPIOs are not a wiring prescription for the supplied ESP32-S3-CAM.

```bash
python -m pip install platformio
cd hardware/firmware
pio run -e wokwi
cd ../wokwi
wokwi-cli .
```

For automated smoke coverage, set your personal `WOKWI_CLI_TOKEN` and run:

```bash
wokwi-cli . --scenario smoke.test.yaml
```

See [`hardware/wokwi/README.md`](hardware/wokwi/README.md) for controls, endpoints, expected behaviour, and validated limitations. The exact real-board pin assignment is deliberately blocked until board photographs and the vendor pinout are available; see [the hardware gate](.genesis/hardware/BOARD-AND-WIRING-GATE.md).

## Deploy the portfolio demo to Vercel

Import the repository as a Next.js project and deploy with Vercel's default framework settings. The browser-only **Simulate Demo** flow works on the free tier without MongoDB or device environment variables.

Real mode needs a reachable MongoDB deployment and a device URL accessible from Vercel. A private address such as `192.168.4.1` is not reachable from a hosted Vercel function, so do not use the hosted demo as proof of real-device connectivity. Keep secrets server-side and configure only the required values in the Vercel project settings.

## HTTP routes

- `POST /api/telemetry/ingest` — ingest one event or an ordered catch-up batch; stable `eventId` values are deduplicated.
- `GET /api/telemetry/latest?deviceId=...` — fetch latest mirrored telemetry.
- `GET /api/history?deviceId=...&from=...&to=...` — search an inclusive range, oldest first.
- `GET /api/devices/{deviceId}/state` — fetch validated device-authoritative state.
- `GET /api/devices/{deviceId}/records?limit=256` — fetch validated rolling records.
- `POST /api/alerts/{alertId}/ack` — forward a scoped acknowledgement; the device decides the first winner.
- `GET /api/alerts?limit=100` — read persisted dashboard and physical acknowledgement entries.

## Specification and evidence

- [Challenge source of truth](.genesis/spec/SOURCE-OF-TRUTH.md)
- [Hardware additions index](.genesis/hardware/README.md)
- [Firmware behaviour specification](.genesis/hardware/FIRMWARE-BEHAVIOR-SPEC.md)
- [Hardware verification matrix](.genesis/hardware/HARDWARE-VERIFICATION-MATRIX.md)
- [Architecture](.genesis/spec/ARCHITECTURE.md)
- [Judge demo checklist](.genesis/spec/JUDGE-DEMO-CHECKLIST.md)

The Wokwi twin validates behaviour and API integration. Real camera capture, exact ESP32-S3-CAM pin safety, relay polarity, power recovery, and physical sensor behaviour still require the supplied hardware and must be recorded in the verification matrix before being claimed as proven.
