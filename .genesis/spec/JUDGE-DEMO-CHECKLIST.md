# Judge Demo Checklist — run in this order

Because credit stops at the first failed stage, do not jump ahead.

- [ ] S1: steady LED + IR every ~1 s; trigger/disconnect IR; no blink freeze.
- [ ] S2: DHT every ~5 s; disconnect DHT; IR/LED continue.
- [ ] S3: first-run AP/setup page; save SSID/password/device name; power cycle reconnect; button reset; unreachable WiFi → setup in ~10–15 s.
- [ ] S4: open device-hosted dashboard; camera + both sensors auto-update ~1–2 s; failed frame does not break page.
- [ ] S5: OCCUPIED/EMPTY changes in ~1–2 s, no flicker, lighting-only change does not falsely trigger.
- [ ] S6: show shuffled trained cards and at least one untrained color; trained recognized, untrained UNKNOWN.
- [ ] S7: generate >256 results; dashboard contains exactly 256 in correct order.
- [ ] S8: show on-device storage limit 150–180 KB and cleared counter after eviction.
- [ ] S9: disconnect WiFi while events continue; reconnect; show OFFLINE→CATCHING_UP→LIVE and exactly-once ordered catch-up.
- [ ] S10: search a recent range; then a pre-start range and show clean empty result.
- [ ] S11: move toward danger; trend reacts without alarm; cross stable danger threshold; buzzer/relay activates; boundary jitter does not flicker.
- [ ] S12: same alert, physical + dashboard ACK at same moment → exactly one acknowledgement; second alert stays independent.
- [ ] S13: power off ~10 s, restore and recover within ~20 s; repeat a second time.

## Before judges arrive
- [ ] Save screenshots/photos needed for documentation.
- [ ] Write exact Stage 11 thresholds in docs.
- [ ] Confirm Mongo/network URLs are correct.
- [ ] Clear only demo data that is safe to clear; do not reset required device state accidentally.
- [ ] Have Serial Monitor ready for Stages 1–2/verification.
