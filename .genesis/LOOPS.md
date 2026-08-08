# LOOPS — Hackathon execution loop

This project does not need external Genesis skills installed. Codex can run the loop from these files.

For each milestone:
1. **Existence check:** inspect existing code first; reuse instead of duplicating.
2. **Plan 3–6 edits:** name exact files before coding.
3. **Build:** make the smallest implementation that satisfies the milestone.
4. **Prove:** run real typecheck/lint/tests plus the milestone demo.
5. **Checkpoint:** update `.genesis/checkpoints/CURRENT.md` with what passed and the next concrete action.
6. **Do not expand scope:** UI redesign and firmware remain teammate-owned.

### Failure loop
If a test fails:
- reproduce once;
- form at least two plausible causes;
- inspect evidence;
- fix the root cause;
- add/keep a regression test.
Do not stack blind fixes.

### Integration loop
When real ESP32 becomes available:
- set `DEVICE_BASE_URL`;
- run the contract checks in `spec/HARDWARE-HANDOFF.md`;
- verify camera URL, state JSON, records, alert ACK;
- run Stage 9 catch-up test;
- do not rewrite backend around one-off firmware quirks without documenting the deviation.
