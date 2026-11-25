/**
 * IdempotentSmith IETF Idempotency-Key Linter
 * Audits endpoint configurations & headers against draft-ietf-httpapi-idempotency-key-header.
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import { IdempotencyAuditInput, IdempotencyAuditResult, IdempotencyIssue } from '../types.js';

const UUID_OR_HIGH_ENTROPY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[A-Za-z0-9_-]{16,128}$/i;

export class IdempotencyLinter {
  static audit(input: IdempotencyAuditInput): IdempotencyAuditResult {
    const issues: IdempotencyIssue[] = [];
    const method = (input.method || 'POST').toUpperCase();
    const isMutating = method === 'POST' || method === 'PATCH';
    const key = (input.idempotencyKey || '').trim();
    const keyPresent = key.length > 0;
    const keyFormatValid = keyPresent && UUID_OR_HIGH_ENTROPY_RE.test(key);
    const ttlHours = input.ttlHours ?? 24;

    // 1. IDEMP-001: Missing Idempotency-Key on mutating endpoint
    if (isMutating && !keyPresent) {
      issues.push({
        code: 'IDEMP-001',
        severity: 'CRITICAL',
        section: 'HEADER',
        message: `Mutating ${method} request lacks an "Idempotency-Key" header. Network retries or client double-clicks will execute duplicate mutations.`,
        recommendation: 'Require a unique UUIDv4/ULID "Idempotency-Key" header on all POST and PATCH mutation endpoints.'
      });
    }

    // 2. IDEMP-002: Low-entropy or invalid key format
    if (keyPresent && !keyFormatValid) {
      issues.push({
        code: 'IDEMP-002',
        severity: 'HIGH',
        section: 'HEADER',
        message: `Idempotency-Key "${key}" has low entropy or unsafe length (<16 chars). Predictable keys risk accidental collisions across requests.`,
        recommendation: 'Generate client-side UUIDv4 (36 chars) or ULID (26 chars) keys per logical operation.'
      });
    }

    // 3. IDEMP-003: Missing atomic lock
    if (!input.enforcesAtomicLock) {
      issues.push({
        code: 'IDEMP-003',
        severity: 'CRITICAL',
        section: 'LOCKING',
        message: 'Endpoint uses check-then-insert instead of an atomic in-flight lock (SET NX / DB UNIQUE constraint). Concurrent requests will trigger TOCTOU double-charges.',
        recommendation: 'Acquire an atomic IN_FLIGHT lock (Redis SET key NX PX or Postgres INSERT ON CONFLICT) before executing business logic.'
      });
    }

    // 4. IDEMP-004: Missing payload fingerprinting
    if (!input.validatesPayloadFingerprint) {
      issues.push({
        code: 'IDEMP-004',
        severity: 'CRITICAL',
        section: 'FINGERPRINT',
        message: 'No SHA-256 request payload fingerprinting configured. A client reusing an Idempotency-Key with a modified amount or recipient will silently receive the old response.',
        recommendation: 'Hash canonicalized method + path + JSON body with SHA-256 and store it alongside the Idempotency-Key.'
      });
    }

    // 5. IDEMP-005: Missing 409 Conflict for in-flight requests
    if (input.returns409OnInFlight === false) {
      issues.push({
        code: 'IDEMP-005',
        severity: 'HIGH',
        section: 'LOCKING',
        message: 'Concurrent requests hitting an IN_FLIGHT lock do not return HTTP 409 Conflict (with Retry-After). Clients may misinterpret locks as fatal errors.',
        recommendation: 'Return HTTP 409 Conflict with "Retry-After: 1" when the original request is still executing.'
      });
    }

    // 6. IDEMP-006: Missing 422 Unprocessable Entity on fingerprint mismatch
    if (input.returns422OnMismatch === false) {
      issues.push({
        code: 'IDEMP-006',
        severity: 'HIGH',
        section: 'FINGERPRINT',
        message: 'Payload fingerprint mismatches do not reject with HTTP 422 Unprocessable Entity as specified by the IETF draft.',
        recommendation: 'Return HTTP 422 Unprocessable Entity when an existing Idempotency-Key is reused with a different request payload.'
      });
    }

    // 7. IDEMP-007: Caching 5xx errors
    if (input.caches5xxErrors) {
      issues.push({
        code: 'IDEMP-007',
        severity: 'CRITICAL',
        section: 'ERRORS',
        message: 'Transient HTTP 5xx server errors are committed to the idempotency store, permanently poisoning future client retries!',
        recommendation: 'Release the IN_FLIGHT lock on 5xx failures so safe retries can re-execute.'
      });
    }

    // 8. IDEMP-008: Missing tenant/user scoping
    if (input.scopesKeyByUser === false) {
      issues.push({
        code: 'IDEMP-008',
        severity: 'HIGH',
        section: 'FINGERPRINT',
        message: 'Idempotency-Key namespace is global rather than scoped by authenticated user/tenant ID. Risk of cross-tenant key collision or information leakage.',
        recommendation: 'Prefix storage keys with authenticated tenant/user ID: `idem:${userId}:${key}`.'
      });
    }

    // 9. IDEMP-009: Short TTL (< 24h)
    if (ttlHours < 24) {
      issues.push({
        code: 'IDEMP-009',
        severity: 'MEDIUM',
        section: 'RETENTION',
        message: `Key retention TTL is ${ttlHours}h (<24h). Delayed mobile or webhook retries arriving the next day will trigger duplicate mutations.`,
        recommendation: 'Set minimum Idempotency-Key retention TTL to 24 hours (Stripe standard).'
      });
    }

    // 10. IDEMP-010: Excessive TTL (> 168h)
    if (ttlHours > 168) {
      issues.push({
        code: 'IDEMP-010',
        severity: 'LOW',
        section: 'RETENTION',
        message: `Key retention TTL is ${ttlHours}h (>7 days), increasing Redis/database storage footprint unnecessarily.`,
        recommendation: 'Keep retention between 24h and 72h for optimal memory efficiency.'
      });
    }

    // 11. IDEMP-011: Missing replay header
    if (input.injectsReplayHeader === false) {
      issues.push({
        code: 'IDEMP-011',
        severity: 'INFO',
        section: 'HEADER',
        message: 'Replayed responses omit the "Idempotent-Replayed: true" diagnostic header.',
        recommendation: 'Inject "Idempotent-Replayed: true" on cached replays for observability and client debugging.'
      });
    }

    // 12. IDEMP-012: Unnecessary enforcement on GET/HEAD
    if ((method === 'GET' || method === 'HEAD') && keyPresent) {
      issues.push({
        code: 'IDEMP-012',
        severity: 'LOW',
        section: 'HEADER',
        message: `Idempotency-Key provided on inherently idempotent ${method} request.`,
        recommendation: 'Skip idempotency locking overhead on GET/HEAD/OPTIONS requests.'
      });
    }

    let penalty = 0;
    for (const iss of issues) {
      if (iss.severity === 'CRITICAL') penalty += 30;
      else if (iss.severity === 'HIGH') penalty += 15;
      else if (iss.severity === 'MEDIUM') penalty += 8;
      else if (iss.severity === 'LOW') penalty += 4;
      else if (iss.severity === 'INFO') penalty += 1;
    }

    const score = Math.max(0, 100 - penalty);
    let grade: 'A+' | 'A' | 'B' | 'C' | 'F' = 'F';
    if (score >= 95) grade = 'A+';
    else if (score >= 85) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 50) grade = 'C';

    return {
      score,
      grade,
      issues,
      isIetfCompliant: score >= 85 && Boolean(input.enforcesAtomicLock) && Boolean(input.validatesPayloadFingerprint) && !input.caches5xxErrors,
      summary: {
        keyPresent,
        keyFormatValid,
        hasAtomicLock: Boolean(input.enforcesAtomicLock),
        hasFingerprint: Boolean(input.validatesPayloadFingerprint),
        ttlHours
      }
    };
  }
}
