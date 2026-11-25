# IdempotentSmith System Architecture

```
Incoming POST/PATCH + Idempotency-Key
                 │
                 ▼
┌─────────────────────────────────────────┐
│ RequestFingerprinter (Canonical SHA256) │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│ IdempotencyLedger (Atomic Lock & TTL)   │
│  - Missing Key -> Acquire IN_FLIGHT     │
│  - Hash Mismatch -> HTTP 422            │
│  - Active IN_FLIGHT -> HTTP 409         │
│  - COMPLETED -> Replay + Header         │
└────────────────┬────────────────────────┘
                 │
                 ▼
      Origin Mutation Handler
```
