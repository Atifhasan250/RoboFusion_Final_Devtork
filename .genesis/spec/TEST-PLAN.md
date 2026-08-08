# Test Plan — prioritize judge failures

## Backend unit/integration tests
1. **Schema rejection:** malformed event => 400.
2. **Duplicate ingest:** same event twice => one stored row.
3. **Batch duplicate:** resend full catch-up batch => no extra rows.
4. **Order:** seq 101,102,103 returned/stored in original order.
5. **History boundary:** records before/inside/after; query returns only inside.
6. **History empty:** returns 200 + empty array.
7. **Concurrent ACK:** two Promise.all requests for same alert => exactly one accepted/one stored acknowledgement.
8. **Separate alerts:** acknowledging alert B never mutates alert A.
9. **Latest state:** newest event is returned.
10. **Device timeout:** device-client uses a short timeout and returns a clean error, not a hanging route.

## Manual integration tests
- Cover camera / break one camera frame: page stays alive and keeps last image.
- Disconnect WiFi: UI shows OFFLINE while device keeps recording.
- Reconnect: CATCHING_UP then LIVE; database shows no missing/duplicate events.
- Search outage interval and confirm all records are present.
- Trigger danger and simultaneous physical+dashboard ACK.
- Power cycle twice and verify device recovers; Next.js/Mongo history remains intact.
