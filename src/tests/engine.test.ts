/**
 * IdempotentSmith Ledger & Race Simulator Tests
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import test from 'node:test';
import assert from 'node:assert';
import { IdempotencyLedger, RaceSimulator } from '../core/idempotencyEngine.js';

test('IdempotencyLedger: handles EXECUTE -> IN_FLIGHT 409 -> COMPLETED REPLAY -> 422 MISMATCH', () => {
  const ledger = new IdempotencyLedger();
  const key = '550e8400-e29b-41d4-a716-446655440000';
  const body = '{"amount": 50}';

  const first = ledger.acquire(key, 'POST', '/v1/charges', body);
  assert.strictEqual(first.action, 'EXECUTE');

  const concurrent = ledger.acquire(key, 'POST', '/v1/charges', body);
  assert.strictEqual(concurrent.action, 'CONFLICT_IN_FLIGHT');
  assert.strictEqual(concurrent.statusCode, 409);

  ledger.commit(key, 201, { 'Content-Type': 'application/json' }, '{"id":"ch_1"}');

  const replay = ledger.acquire(key, 'POST', '/v1/charges', body);
  assert.strictEqual(replay.action, 'REPLAY');
  assert.strictEqual(replay.replayed, true);
  assert.strictEqual(replay.headers['Idempotent-Replayed'], 'true');

  const mismatch = ledger.acquire(key, 'POST', '/v1/charges', '{"amount": 999}');
  assert.strictEqual(mismatch.action, 'UNPROCESSABLE_MISMATCH');
  assert.strictEqual(mismatch.statusCode, 422);
});

test('RaceSimulator: proves zero double charges with atomic lock', async () => {
  const sim = await RaceSimulator.simulate(40, 50);
  assert.strictEqual(sim.unprotected.doubleChargeCount, 39);
  assert.strictEqual(sim.atomicLockFingerprint.ledgerExecutions, 1);
  assert.strictEqual(sim.atomicLockFingerprint.doubleChargeCount, 0);
  assert.strictEqual(sim.atomicLockFingerprint.financialLeakageUsd, 0);
});
