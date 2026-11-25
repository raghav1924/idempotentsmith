# IETF Idempotency-Key Specification Rules

IdempotentSmith audits endpoints against `draft-ietf-httpapi-idempotency-key-header`:
- **IDEMP-001 (Critical):** Missing `Idempotency-Key` on mutating `POST`/`PATCH`.
- **IDEMP-002 (High):** Weak/low-entropy key (<16 chars).
- **IDEMP-003 (Critical):** Missing atomic in-flight lock.
- **IDEMP-004 (Critical):** Missing SHA-256 payload fingerprinting.
- **IDEMP-005 (High):** Missing `409 Conflict` for concurrent in-flight collisions.
- **IDEMP-006 (High):** Missing `422 Unprocessable Entity` on payload mismatch.
- **IDEMP-007 (Critical):** Caching `5xx` transient server errors.
- **IDEMP-008 (High):** Missing tenant/user key scoping.
- **IDEMP-009 / 010:** Retention TTL bounds (24h–168h).
- **IDEMP-011 / 012:** Replay diagnostic header and safe-method bypass.
