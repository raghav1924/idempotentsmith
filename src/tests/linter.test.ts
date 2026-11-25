/**
 * IdempotentSmith Linter Tests
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import test from 'node:test';
import assert from 'node:assert';
import { IdempotencyLinter } from '../linter/idempotencyLinter.js';

test('IdempotencyLinter: detects missing key, missing lock, and 5xx caching', () => {
  const res = IdempotencyLinter.audit({
    method: 'POST',
    enforcesAtomicLock: false,
    validatesPayloadFingerprint: false,
    caches5xxErrors: true
  });

  assert.ok(res.issues.some((i) => i.code === 'IDEMP-001'));
  assert.ok(res.issues.some((i) => i.code === 'IDEMP-003'));
  assert.ok(res.issues.some((i) => i.code === 'IDEMP-004'));
  assert.ok(res.issues.some((i) => i.code === 'IDEMP-007'));
  assert.strictEqual(res.isIetfCompliant, false);
});

test('IdempotencyLinter: awards A+ to hardened IETF endpoint', () => {
  const res = IdempotencyLinter.audit({
    method: 'POST',
    idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    enforcesAtomicLock: true,
    validatesPayloadFingerprint: true,
    returns409OnInFlight: true,
    returns422OnMismatch: true,
    ttlHours: 24,
    caches5xxErrors: false,
    injectsReplayHeader: true,
    scopesKeyByUser: true
  });

  assert.strictEqual(res.grade, 'A+');
  assert.strictEqual(res.score, 100);
  assert.strictEqual(res.isIetfCompliant, true);
});
