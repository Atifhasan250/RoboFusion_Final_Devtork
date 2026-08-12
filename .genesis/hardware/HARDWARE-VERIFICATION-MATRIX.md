# Hardware Verification Matrix

Never mark a stage complete from a dashboard screenshot alone. Capture Serial
Monitor, device-hosted page, physical output, and server evidence as applicable.

| Stage | Automated/simulation evidence | Required real-device evidence |
|---:|---|---|
| 1 | Timing trace: LED toggles every 100 ms while IR events/faults run | 10-second LED observation; repeated trigger; physical disconnect with clear error |
| 2 | Independent 1 s IR and 5 s climate timestamps; fault injection | Observe ~20 seconds; disconnect DHT11; LED and IR continue |
| 3 | Network state-machine tests; NVS adapter tests | Setup AP/form; save/connect; power cycle; long-press reset; unreachable fallback in 10–15 s |
| 4 | JSON polling and last-good-frame failure test | Page served directly by ESP32; camera + both readings match Serial; cover lens |
| 5 | Flicker, lighting-only, and 1-second hold scenarios | Person/object enter/leave plus lighting-only test on real camera |
| 6 | Five-class scenario contract including UNKNOWN | Shuffled 10 known cards: at least 9 correct; two unseen colors both UNKNOWN |
| 7 | Accelerated 300-record test repeated twice; exact 256 ordered | Device page shows the same bounded record without blanks/duplicates |
| 8 | Two bounded-store fill cycles and recovery test | Real flash never exceeds displayed 170 KiB; cleared counter survives restart |
| 9 | Drop/restore scenario; stable IDs; ordered batch and server dedupe tests | About 3-minute Wi-Fi outage; all outage events later appear once and in order |
| 10 | Inclusive range query and clean empty result; index test | Recent and pre-start searches complete cleanly around the 1-second target |
| 11 | Boundary/debounce/trend tests; trend cannot drive outputs | Gradual approach, true threshold crossing, rapid boundary movement; relay/buzzer observed |
| 12 | Concurrent ACK test for same ID and independence test for two IDs | Two people/inputs race one alert; exactly one log row; second alert remains separate |
| 13 | Persist/reset/recover scenario twice | Main power off ~10 seconds, restore twice; full state/output agreement within ~20 seconds |

## Cross-system contract checks

- Device `eventId` is stable across retries.
- `seq` preserves original creation order and does not collide after restart.
- Catch-up batches are strictly ascending.
- The server may receive a retry but stores one event per `eventId`.
- The device remains the Stage 8 persistent store; MongoDB is only a mirror.
- Device and Next.js pages show the same current state when both are online.
- Camera frame failure preserves the last good image.
- One alert produces one winning acknowledgement, regardless of input source.

## Evidence bundle for the portfolio

- exact final wiring diagram and annotated build photos;
- short Wokwi demo GIF/video with limitations captioned;
- serial timing trace for Stages 1–2;
- real device-hosted dashboard and camera capture;
- 300-to-256 record test result;
- storage fill/eviction counters before and after restart;
- offline/catch-up sequence and deduplication result;
- status/trend/alarm boundary demonstration;
- simultaneous acknowledgement log;
- two power-recovery timestamps;
- link to the hosted Next.js demo, clearly labeled as mock/demo data when no
  physical ESP32 is connected.

