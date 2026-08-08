# Documentation Plan — 85 marks

Do this in parallel; one teammate can fill it while others build.

## 1. Wiring diagram — 15
Hardware teammate supplies exact pins/connections. Do not guess.

## 2. Overall structure + information flow — 15
Use the Mermaid diagram in `ARCHITECTURE.md` as the base, then add actual endpoint names/IPs used in the final build.

## 3. Plain-language explanation of all 13 stages — 25
Use `SOURCE-OF-TRUTH.md` headings. Under each stage add 2–4 sentences:
- what was built,
- how it works,
- how failure is handled,
- what the judge sees.
Only document what actually works.

## 4. Three detailed explanations — 20
- Stage 3 WiFi: AP setup → save credentials → reconnect → button reset → fallback after ~10–15 s.
- Stage 6 marker: how the camera decides Red/Blue/Yellow/Green vs UNKNOWN; include actual thresholds/calibration used by firmware.
- Stage 11 status: exact Safe/Warning/Danger thresholds, debounce time, and separate trend calculation.

## 5. Presentation quality — 10
One clean document, consistent names, architecture diagram, wiring diagram, no contradictions with live demo.
