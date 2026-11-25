/**
 * IdempotentSmith Reverse Proxy Integration Tests
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { IdempotencyProxy } from '../proxy/idempotencyProxy.js';

function postJson(url: string, body: string, idemKey?: string): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idemKey) headers['Idempotency-Key'] = idemKey;
    const req = http.request(url, { method: 'POST', headers }, (res: http.IncomingMessage) => {
      let data = '';
      res.on('data', (c: any) => (data += c));
      res.on('end', () => resolve({ statusCode: res.statusCode || 200, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

test('IdempotencyProxy: executes once, replays identically, and returns 422 on payload tamper', async () => {
  const port = 8998;
  const proxy = new IdempotencyProxy({ port, requireKey: true });
  await proxy.start();

  try {
    const key = '550e8400-e29b-41d4-a716-446655440001';
    const body = '{"amount": 100, "currency": "USD"}';

    const r1 = await postJson(`http://localhost:${port}/v1/charges`, body, key);
    assert.strictEqual(r1.statusCode, 201);
    assert.strictEqual(r1.headers['x-idempotency-status'], 'LOCK_ACQUIRED');

    // Reordered JSON keys should still match and replay!
    const r2 = await postJson(`http://localhost:${port}/v1/charges`, '{"currency":"USD","amount":100}', key);
    assert.strictEqual(r2.statusCode, 201);
    assert.strictEqual(r2.headers['idempotent-replayed'], 'true');
    assert.strictEqual(r2.body, r1.body);

    // Tampered amount with same key -> 422
    const r3 = await postJson(`http://localhost:${port}/v1/charges`, '{"amount": 999, "currency": "USD"}', key);
    assert.strictEqual(r3.statusCode, 422);
  } finally {
    await proxy.stop();
  }
});
