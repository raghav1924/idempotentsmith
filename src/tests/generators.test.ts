/**
 * IdempotentSmith Middleware Generator Tests
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import test from 'node:test';
import assert from 'node:assert';
import { IdempotencyGenerator } from '../generators/idempotencyGen.js';
import { FrameworkType } from '../types.js';

test('IdempotencyGenerator: produces valid middleware for all 6 frameworks', () => {
  const frameworks: FrameworkType[] = ['nextjs', 'express', 'fastify', 'cloudflare', 'hono', 'fastapi'];
  for (const fw of frameworks) {
    const out = IdempotencyGenerator.generate(fw, { ttlHours: 48 });
    assert.strictEqual(out.framework, fw);
    assert.ok(out.code.length > 100);
    assert.ok(out.filename.length > 0);
  }
});
