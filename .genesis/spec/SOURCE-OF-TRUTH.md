# SOURCE OF TRUTH — RoboFusion 1.0 Grand Finale

This is a faithful implementation-oriented transcription of the 20-page problem statement. When any other note conflicts with this file, follow the problem statement.

## Global rules
- Total: **400 marks** = 13 sequential stages (**315**) + documentation (**85**).
- Stages must be demonstrated **strictly in order**. A later stage is not credited unless all earlier stages passed.
- Every later stage adds to the same system. Do not replace or throw away earlier behavior.
- Only **one microcontroller** may be used for the full build.
- Any approach/library/method is allowed if the requirement is met exactly.
- The scenario text explains why the requirement matters; it is not an extra task.

## Provided hardware
- ESP32-S3-CAM board with camera and built-in USB port.
- DHT11 temperature + humidity sensor.
- IR obstacle sensor.
- 1-channel 5V relay module.
- Buzzer.
- Momentary push-button.
- Indicator LEDs.
- Breadboard + jumper wires.
- Four camera-learning cards: Red, Blue, Yellow, Green.

## How stages connect
- Stages 1–2: Serial Monitor.
- Stage 3: separate WiFi setup page.
- Stage 4 onward: one dashboard page; every new stage adds to it and earlier items stay visible.
- 1→2: second sensor is added without changing Stage 1 timing.
- 2→3: first real network connection; everything Stage 4 onward depends on it.
- 3→4: live dashboard begins and shows camera + both sensor readings.
- 4→5→6: add presence detection, then marker recognition.
- 6→7: combine sensors + presence + marker into one rolling record.
- 7→8: save that record permanently within a strict device-storage limit.
- 8→9: saved data must continue while WiFi is unavailable.
- 9→10: records sent after reconnect populate searchable history.
- 10→11: overall safety status/early-warning uses the same running/stored information.
- 11→12: danger alerts produced by the safety logic are the alerts that get acknowledged.
- 12→13: no new feature; prove the entire combined system survives power loss.

---

## Stage 1 — Steady Heartbeat, No Freezing — 8 marks
**Must do**
- Indicator light blinks continuously and steadily, roughly 5 times/second (about 100 ms on, 100 ms off).
- IR sensor is checked on its own schedule, roughly once/second.
- Blinking and sensor reading must not pause/block each other, even if the sensor is repeatedly triggered.
- If the sensor is disconnected, show a clear error instead of freezing/garbage; LED must keep blinking normally.
- Serial Monitor shows IR readings on schedule while LED blinks steadily.

**Pass idea:** blink speed never changes during trigger/disconnect; clear disconnect error; readings resume after reconnect.

## Stage 2 — A Second Sensor, Its Own Timing — 12 marks
**Must do**
- Add DHT11 temperature/humidity on its own schedule, roughly once every 5 seconds.
- Stage 1 keeps exactly the same behavior/rates.
- DHT failure gives a clear message and everything else continues.
- Serial Monitor shows IR and temperature/humidity, each on its own independent schedule.

**Pass idea:** both update rates are visible; disconnecting DHT does not freeze LED or IR.

## Stage 3 — WiFi Setup & Network Memory — 15 marks
**Must do**
- WiFi name must not be hardcoded as the permanent solution.
- If no saved network exists, device creates its own temporary setup network and a setup page.
- Setup page fields: real WiFi name, password, device name.
- Save the information across power loss and reconnect automatically after power cycle.
- Push-button deliberately clears saved network information and returns device to setup mode.
- If saved WiFi is unreachable, try briefly (~10–15 s), then return to setup mode instead of waiting forever.
- Setup page is separate from the main dashboard that begins in Stage 4.

**Pass:** own setup network when unsaved/reset; real credentials connect; automatic reconnect after power cycle; button genuinely clears credentials; unreachable network falls back to setup in ~10–15 s.

## Stage 4 — Live Web Dashboard — 15 marks
**Must do**
- Build a webpage **hosted directly by the device itself**.
- One page shows camera live view + both sensor readings.
- Refresh/update on its own roughly every 1–2 seconds; no manual reload.
- If camera image occasionally fails, page keeps the last image rather than breaking.
- Judges may cover the camera and compare live values with the Serial Monitor.

**Pass:** camera + both sensor values update live; no broken-image crash/freeze.

## Stage 5 — Vision: Presence Detection — 18 marks
**Must do**
- Use camera live view to decide whether someone/something is currently present.
- Dashboard shows clear status such as `OCCUPIED` / `EMPTY`.
- Accept state change only after it has been steady for about 1 second so one flickering frame does not switch state.
- Do not falsely trigger just because room lighting changes; an actual person/object entering/leaving should change state.
- Keep all Stage 4 dashboard items.

**Pass:** correct presence/absence switching in about 1–2 s, no flicker, lighting-only change does not create false presence.

## Stage 6 — Vision: Marker Recognition — 20 marks
**Must do**
- Learn/recognize the 4 specific card colors: Red, Blue, Yellow, Green.
- Correctly identify which trained color is shown and display it on dashboard.
- Any non-trained color/object must be `UNKNOWN`/not recognized, not guessed as one of the 4.
- Keep all Stages 4–5 dashboard items.

**Pass:** at least 9/10 trained-color cards correct; untrained cards correctly `UNKNOWN` and never guessed as a trained color.

## Stage 7 — Combined Rolling Record — 22 marks
**Must do**
- Keep a running in-memory record of the **most recent 256 combined results**.
- Update roughly every 2 seconds.
- Each entry combines latest sensor readings + latest camera result(s) into one entry.
- After 256 entries, every new entry replaces exactly one oldest entry; record never grows beyond 256.
- Dashboard lists current record contents in order.

**Pass:** after ~300 generated results, exactly 256 remain, correct order, no missing/blank/duplicate entries; repeat test still works.

## Stage 8 — Permanent Storage Under a Limit — 25 marks
**Must do**
- Save combined records permanently in the **device's own storage** so they survive restart.
- Keep total saved data inside a fixed clearly displayed limit around **150–180 KB**.
- When limit is reached, automatically delete oldest saved data to make room.
- Dashboard shows a running count of how much data has been cleared this way.
- This is device storage; MongoDB does not replace this requirement.

**Pass:** storage remains inside stated limit across multiple fill cycles; cleared-data counter increments; system does not get stuck.

## Stage 9 — Working Offline & Catching Up — 28 marks
**Must do**
- If WiFi is lost, device keeps collecting and saving normally.
- On reconnect, send everything collected offline in the correct original order.
- Never send the same offline item twice.
- Dashboard clearly shows transition such as `Live → Offline → Catching Up → Live`.

**Pass:** after about 3 minutes disconnected, every outage event appears later in correct order exactly once.

## Stage 10 — Searchable History Dashboard — 30 marks
**Must do**
- All saved/received history is searchable from dashboard by specific start time + end time.
- Return only results genuinely inside that range.
- Search should feel fast; about 1 second, not a long wait.
- Empty range gives clean `nothing found` behavior, never error/crash.
- Keep all Stages 4–9 items.

**Pass:** recent range correct; range before device startup returns clean empty result.

## Stage 11 — Overall Status & Early-Warning Guess — 35 marks
**Must do**
- Combine readings into one simple 3-level overall status of your choosing, e.g. `SAFE`, `WARNING`, `DANGER`.
- On `DANGER`, buzzer/relay activates.
- Danger transition should only happen after holding steady ~1–2 seconds so a brief spike does not flicker alarm.
- Separately estimate whether conditions seem to be moving toward Danger based on recent trend.
- Trend/early-warning must be a clearly separate indicator, e.g. `RISING`, `STABLE`, `FALLING`.
- Early warning alone must **never** activate buzzer/relay.
- Dashboard shows both badges and all earlier features.

**Recommended simple rule for the team:** let the device compute severity as the maximum of temperature/humidity threshold severity; use `SAFE < WARNING < DANGER`, require 1.5 s stable before DANGER. Trend can compare a small recent window and output Rising/Stable/Falling. Keep the exact thresholds documented so judges can reproduce them.

**Pass:** early warning reacts before danger with no alarm; real danger triggers alarm; quick boundary movement does not flicker on/off.

## Stage 12 — Handling Two Actions at the Same Moment — 40 marks
**Must do**
- A Danger alert can be acknowledged in **two separate ways**: physical push-button and dashboard button.
- If two people acknowledge the same alert at the exact same moment, exactly **one** acknowledgement counts — never 2, never 0.
- Two separate alerts close together must remain independent; acknowledging one must never acknowledge the other.
- Dashboard includes acknowledgement log plus everything through Stage 11.

**Pass:** simultaneous attempts create exactly one acknowledgement; separate alerts are tracked independently and never mixed.

## Stage 13 — Full Recovery Test — 47 marks
**Must do**
- Everything from all earlier stages works together at the same time on the same device.
- Cut main power completely; after restore everything comes back correct and dashboard matches physical lights/buzzer.
- Must succeed more than once in a row.
- Judges wait ~10 seconds with power off, restore, then expect correct/consistent system within about **20 seconds**.

**Pass:** both recovery attempts restore everything correctly within ~20 s with nothing lost.

---

# Documentation — 85 marks
Prepare during the build; do not wait until the end.
- **15:** wiring diagram showing exactly how components are connected. (Hardware teammate owns the exact pin/wiring content.)
- **15:** overall system structure/information-flow diagram.
- **25:** short plain-language explanation of the approach for each of the 13 stages.
- **20:** explain in your own words: Stage 3 WiFi setup design, Stage 6 marker recognition, Stage 11 status/warning approach.
- **10:** clear, well-organized presentation overall.

Judges compare documentation to what was actually demonstrated, so do not document fake/unbuilt behavior.
