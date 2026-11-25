# Race Condition & TOCTOU Analysis

When two identical `POST /v1/charges` requests arrive within 2ms:
- A naive `GET` followed by `SET` allows both requests to observe an empty key before either commits.
- An atomic `IN_FLIGHT` acquisition guarantees only 1 request enters the origin handler while concurrent callers receive `409 Conflict` and subsequent retries receive deterministic replays.
