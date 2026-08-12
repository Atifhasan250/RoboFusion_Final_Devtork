# Board and Wiring Gate

## Why GPIO numbers are not written yet

The question paper names an `ESP32-S3-CAM board with its own camera and built-in
USB port`, but does not name the exact board revision. ESP32-S3 camera boards do
not share one universal pinout. Guessing a pin can conflict with the camera,
flash/PSRAM, USB, boot strapping, or an unavailable header pin.

No document or diagram may call a wiring map “exact” until the following gate is
complete.

## Board-identification gate

Collect and commit these items before firmware wiring begins:

- clear front and back board photos;
- manufacturer, full product name, and revision printed on the PCB;
- camera sensor/module marking, if visible;
- a vendor pinout or schematic matching that exact revision;
- header labels visible on the supplied board;
- whether the relay input is safely triggered by 3.3 V logic;
- whether the buzzer is active or passive;
- IR module output polarity and its behavior when disconnected;
- available flash and PSRAM size reported by a diagnostic sketch.

The pin map is frozen only after a continuity/diagnostic test and review against
the camera pin definitions used by the board support package.

## Supplied bill of materials

| Item | Quantity | Role |
|---|---:|---|
| ESP32-S3-CAM with built-in USB | 1 | The only microcontroller, camera, Wi-Fi, web server, storage, and authority |
| DHT11 | 1 | Temperature and humidity |
| IR obstacle sensor | 1 | Independent Stage 1 digital input |
| 1-channel 5 V relay module | 1 | Physical Danger output |
| Buzzer | 1 | Audible Danger output |
| Momentary push-button | 1 | Short-press ACK; deliberate long-press Wi-Fi reset |
| Indicator LEDs | As supplied | Heartbeat and optional state indication |
| Breadboard and jumpers | As supplied | Interconnect |
| Red, Blue, Yellow, Green cards | 4 | Camera marker calibration and recognition |

Only this single ESP32-S3 microcontroller is permitted. A laptop, MongoDB, or a
second board must never be presented as the device-side implementation.

## Logical signal map to freeze

Fill the `Physical GPIO` column only after the board-identification gate.

| Logical signal | Direction | Electrical expectation | Physical GPIO |
|---|---|---|---|
| `HEARTBEAT_LED` | Output | LED through an appropriate current-limiting resistor | TBD |
| `IR_DIGITAL` | Input | 3.3 V-safe digital level; record active polarity | TBD |
| `DHT_DATA` | Input/output | DHT11 single-wire data with required pull-up | TBD |
| `RELAY_CONTROL` | Output | 3.3 V-compatible relay input; record active polarity | TBD |
| `BUZZER_CONTROL` | Output/PWM | Match active/passive buzzer type | TBD |
| `USER_BUTTON` | Input | `INPUT_PULLUP`, active-low, hardware/software debounced | TBD |

Camera pins are board-defined and must come from the matching board schematic or
camera example. Do not duplicate them in the table as general-purpose outputs.

## One-button interaction contract

The supplied equipment lists one momentary button, while Stage 3 needs a Wi-Fi
reset and Stage 12 needs physical alert acknowledgement. The actions are made
unambiguous by duration and state:

- press under 2 seconds while an alert is open: request physical ACK;
- press under 2 seconds with no alert: no destructive action;
- continuous press for at least 5 seconds: deliberately clear saved Wi-Fi and
  device name, then enter setup mode;
- the firmware shows a serial/LED countdown before the long-press reset commits;
- button bounce is filtered and one physical press produces at most one event.

Long-press reset has precedence only after the full 5-second hold. A short ACK
must never clear credentials.

## Electrical and assembly checks

- Power off before moving wires.
- Use a common ground for the ESP32, sensors, relay input, and buzzer circuit.
- Do not feed a 5 V sensor/module output directly into a non-5 V-tolerant ESP32
  GPIO. Verify module output voltage first and level-shift if required.
- Verify relay-module 3.3 V trigger compatibility; do not infer it from “5 V
  relay” wording.
- Use a transistor/driver and flyback protection if the supplied buzzer or relay
  interface requires more GPIO current than the board can safely source.
- Keep camera and USB wiring clear and mechanically strain-relieved.
- Record active-high/active-low polarity in the final diagram and firmware config.

## Artifacts required after the gate

- exact pin table with board model/revision;
- breadboard wiring diagram matching the demonstrated build;
- annotated front/back build photos;
- boot diagnostic output confirming board, flash, PSRAM, and assigned pins;
- a safe-power note for the relay and buzzer interfaces.

