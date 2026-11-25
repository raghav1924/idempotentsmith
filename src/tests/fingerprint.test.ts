/**
 * IdempotentSmith Fingerprinter Tests
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import test from 'node:test';
import assert from 'node:assert';
import { RequestFingerprinter } from '../core/fingerprint.js';

test('RequestFingerprinter: produces identical SHA-256 regardless of JSON key ordering', () => {
  const fp1 = RequestFingerprinter.compute('POST', '/v1/charges', '{"amount": 50, "currency": "USD", "meta": {"b": 2, "a": 1}}');
  const fp2 = RequestFingerprinter.compute('POST', '/v1/charges', '{"meta":{"a":1,"b":2},"currency":"USD","amount":50}');

  assert.strictEqual(fp1.fingerprintSha256, fp2.fingerprintSha256);
});

test('RequestFingerprinter: detects payload tampering with verifyMatch', () => {
  const original = RequestFingerprinter.compute('POST', '/v1/charges', '{"amount": 50, "currency": "USD"}');
  const tampered = RequestFingerprinter.verifyMatch(original.fingerprintSha256, 'POST', '/v1/charges', '{"amount": 500, "currency": "USD"}');

  assert.strictEqual(tampered.matches, false);
});
