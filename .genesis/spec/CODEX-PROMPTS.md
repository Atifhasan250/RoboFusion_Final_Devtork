# Useful Codex prompts

## Main build prompt
Use `.genesis/KICKOFF.md`.

## If Codex starts touching frontend design
```text
Stop visual work. The frontend teammate owns layout/style/components. Restrict yourself to typed API client/hooks and backend routes listed in AGENTS.md. Re-read .genesis/spec/FRONTEND-CONTRACT.md.
```

## When hardware becomes available
```text
Read .genesis/spec/HARDWARE-HANDOFF.md and DATA-CONTRACTS.md. Do not change the domain contract unless the real firmware makes it impossible. Configure DEVICE_BASE_URL, run each endpoint manually, then run duplicate catch-up and concurrent-ack tests. Record any mismatch before adapting code.
```

## Final audit
```text
Audit the repo against every checkbox in .genesis/spec/JUDGE-DEMO-CHECKLIST.md. For each stage label software status as READY, HARDWARE-OWNED, INTEGRATION-BLOCKED, or MISSING. Do not claim hardware-owned behavior is implemented by Next.js. Fix only MISSING software blockers, then rerun typecheck/lint/tests.
```
