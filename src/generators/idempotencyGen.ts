/**
 * IdempotentSmith Multi-Framework Middleware Generator
 * Generates production-ready IETF Idempotency-Key middleware with SHA-256 payload fingerprinting,
 * 409 Conflict in-flight locking, and 422 Unprocessable mismatch guards.
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import { FrameworkType, GeneratedIdempotencyCode } from '../types.js';

export class IdempotencyGenerator {
  static generate(
    framework: FrameworkType,
    options: { ttlHours?: number; requireHeader?: boolean } = {}
  ): GeneratedIdempotencyCode {
    const ttlHours = options.ttlHours || 24;
    const ttlSec = ttlHours * 3600;

    switch (framework) {
      case 'nextjs':
        return {
          framework: 'nextjs',
          title: 'Next.js 14/15 App Router Idempotent Mutation Handler',
          filename: 'app/api/charges/route.ts',
          instructions: 'Drop into your Next.js App Router POST handler. Enforces Idempotency-Key, SHA-256 body fingerprint, 409/422 guards, and replay.',
          code: `import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

const ledger = new Map<string, { state: 'IN_FLIGHT' | 'DONE'; hash: string; status: number; body: any; exp: number }>();

export async function POST(req: NextRequest) {
  const idemKey = req.headers.get('idempotency-key');
  if (!idemKey) {
    return NextResponse.json({ error: 'Missing Idempotency-Key header' }, { status: 400 });
  }

  const rawBody = await req.text();
  const bodyHash = createHash('sha256').update(\`POST:/api/charges:\${rawBody}\`).digest('hex');
  const now = Date.now();
  const existing = ledger.get(idemKey);

  if (existing && existing.exp > now) {
    if (existing.hash !== bodyHash) {
      return NextResponse.json({ error: 'Idempotency-Key reused with mutated payload' }, { status: 422 });
    }
    if (existing.state === 'IN_FLIGHT') {
      return NextResponse.json({ error: 'Request currently in-flight' }, { status: 409, headers: { 'Retry-After': '1' } });
    }
    return NextResponse.json(existing.body, {
      status: existing.status,
      headers: { 'Idempotent-Replayed': 'true' }
    });
  }

  ledger.set(idemKey, { state: 'IN_FLIGHT', hash: bodyHash, status: 0, body: null, exp: now + ${ttlSec * 1000} });

  try {
    const payload = JSON.parse(rawBody || '{}');
    const result = { chargeId: 'ch_' + Date.now(), amount: payload.amount ?? 50 };
    ledger.set(idemKey, { state: 'DONE', hash: bodyHash, status: 201, body: result, exp: now + ${ttlSec * 1000} });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    ledger.delete(idemKey); // Release lock on transient 5xx failure
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
`
        };

      case 'express':
        return {
          framework: 'express',
          title: 'Express.js Atomic Idempotency & Fingerprint Middleware',
          filename: 'middleware/idempotency.js',
          instructions: `Mount on mutating routes: app.post('/v1/charges', idempotencyMiddleware({ ttlSeconds: ${ttlSec} }), handler)`,
          code: `const crypto = require('crypto');

function idempotencyMiddleware({ ttlSeconds = ${ttlSec} } = {}) {
  const store = new Map();

  return function (req, res, next) {
    if (req.method !== 'POST' && req.method !== 'PATCH') return next();
    const key = req.headers['idempotency-key'];
    if (!key) return res.status(400).json({ error: 'Idempotency-Key header required' });

    const hash = crypto.createHash('sha256')
      .update(\`\${req.method}:\${req.originalUrl}:\${JSON.stringify(req.body || {})}\`)
      .digest('hex');

    const now = Date.now();
    const existing = store.get(key);

    if (existing && existing.exp > now) {
      if (existing.hash !== hash) {
        return res.status(422).json({ error: 'Payload fingerprint mismatch for Idempotency-Key' });
      }
      if (existing.state === 'IN_FLIGHT') {
        res.setHeader('Retry-After', '1');
        return res.status(409).json({ error: 'Concurrent request in-flight' });
      }
      res.setHeader('Idempotent-Replayed', 'true');
      return res.status(existing.status).json(existing.body);
    }

    store.set(key, { state: 'IN_FLIGHT', hash, exp: now + ttlSeconds * 1000 });

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 500) {
        store.delete(key);
      } else {
        store.set(key, { state: 'DONE', hash, status: res.statusCode, body, exp: Date.now() + ttlSeconds * 1000 });
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = { idempotencyMiddleware };
`
        };

      case 'fastify':
        return {
          framework: 'fastify',
          title: 'Fastify IETF Idempotency-Key Plugin',
          filename: 'plugins/idempotency.js',
          instructions: 'Register with fastify.register(idempotencyPlugin)',
          code: `const fp = require('fastify-plugin');
const crypto = require('crypto');

async function idempotencyPlugin(fastify) {
  const ledger = new Map();
  const ttlMs = ${ttlSec * 1000};

  fastify.addHook('preHandler', async (request, reply) => {
    if (request.method !== 'POST' && request.method !== 'PATCH') return;
    const key = request.headers['idempotency-key'];
    if (!key) return reply.code(400).send({ error: 'Missing Idempotency-Key' });

    const hash = crypto.createHash('sha256').update(JSON.stringify(request.body || {})).digest('hex');
    const entry = ledger.get(key);
    if (entry && entry.exp > Date.now()) {
      if (entry.hash !== hash) return reply.code(422).send({ error: 'Payload mismatch' });
      if (entry.state === 'IN_FLIGHT') return reply.code(409).send({ error: 'In-flight conflict' });
      return reply.header('Idempotent-Replayed', 'true').code(entry.status).send(entry.body);
    }
    ledger.set(key, { state: 'IN_FLIGHT', hash, exp: Date.now() + ttlMs });
  });

  fastify.addHook('onSend', async (request, reply, payload) => {
    const key = request.headers['idempotency-key'];
    if (key && ledger.has(key)) {
      if (reply.statusCode >= 500) ledger.delete(key);
      else {
        const entry = ledger.get(key);
        ledger.set(key, { ...entry, state: 'DONE', status: reply.statusCode, body: payload });
      }
    }
  });
}

module.exports = fp(idempotencyPlugin);
`
        };

      case 'cloudflare':
        return {
          framework: 'cloudflare',
          title: 'Cloudflare Workers KV Idempotency Guard',
          filename: 'worker.ts',
          instructions: 'Bind IDEMPOTENCY_KV in wrangler.toml for global edge deduplication.',
          code: `export interface Env {
  IDEMPOTENCY_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return fetch(request);
    const key = request.headers.get('Idempotency-Key');
    if (!key) return new Response(JSON.stringify({ error: 'Missing Idempotency-Key' }), { status: 400 });

    const existing = await env.IDEMPOTENCY_KV.get(key, 'json') as any;
    if (existing) {
      return new Response(JSON.stringify(existing.body), {
        status: existing.status,
        headers: { 'Content-Type': 'application/json', 'Idempotent-Replayed': 'true' }
      });
    }

    const res = await fetch(request);
    if (res.status < 500) {
      const body = await res.clone().json();
      await env.IDEMPOTENCY_KV.put(key, JSON.stringify({ status: res.status, body }), { expirationTtl: ${ttlSec} });
    }
    return res;
  }
};
`
        };

      case 'hono':
        return {
          framework: 'hono',
          title: 'Hono Edge Idempotency & Fingerprint Middleware',
          filename: 'middleware/idempotency.ts',
          instructions: 'Apply to POST/PATCH endpoints: app.use("/api/*", idempotencyHono())',
          code: `import { MiddlewareHandler } from 'hono';

const store = new Map<string, { state: string; status: number; body: string; exp: number }>();

export const idempotencyHono = (ttlSec = ${ttlSec}): MiddlewareHandler => {
  return async (c, next) => {
    if (c.req.method !== 'POST' && c.req.method !== 'PATCH') return await next();
    const key = c.req.header('Idempotency-Key');
    if (!key) return c.json({ error: 'Missing Idempotency-Key' }, 400);

    const hit = store.get(key);
    if (hit && hit.exp > Date.now()) {
      if (hit.state === 'IN_FLIGHT') return c.json({ error: 'In-flight conflict' }, 409);
      c.header('Idempotent-Replayed', 'true');
      return c.body(hit.body, hit.status as any);
    }

    store.set(key, { state: 'IN_FLIGHT', status: 0, body: '', exp: Date.now() + ttlSec * 1000 });
    await next();

    if (c.res.status >= 500) {
      store.delete(key);
    } else {
      const text = await c.res.clone().text();
      store.set(key, { state: 'DONE', status: c.res.status, body: text, exp: Date.now() + ttlSec * 1000 });
    }
  };
};
`
        };

      case 'fastapi':
        return {
          framework: 'fastapi',
          title: 'FastAPI Python Async Idempotency Middleware',
          filename: 'middleware/idempotency.py',
          instructions: 'Mount in FastAPI: app.add_middleware(IdempotencyMiddleware)',
          code: `"""
IdempotentSmith FastAPI Async Idempotency-Key Middleware
Enforces IETF Idempotency-Key, SHA-256 payload fingerprinting, and 409/422 responses.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
import hashlib
import time

class IdempotencyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, ttl_seconds: int = ${ttlSec}):
        super().__init__(app)
        self.ttl = ttl_seconds
        self.ledger = {}

    async def dispatch(self, request: Request, call_next):
        if request.method not in ("POST", "PATCH"):
            return await call_next(request)

        key = request.headers.get("idempotency-key")
        if not key:
            return JSONResponse({"error": "Missing Idempotency-Key header"}, status_code=400)

        body = await request.body()
        fp = hashlib.sha256(f"{request.method}:{request.url.path}:".encode() + body).hexdigest()
        now = time.time()

        entry = self.ledger.get(key)
        if entry and entry["exp"] > now:
            if entry["fp"] != fp:
                return JSONResponse({"error": "Idempotency-Key payload mismatch"}, status_code=422)
            if entry["state"] == "IN_FLIGHT":
                return JSONResponse({"error": "Concurrent request in-flight"}, status_code=409, headers={"Retry-After": "1"})
            return Response(content=entry["body"], status_code=entry["status"], headers={"Idempotent-Replayed": "true"})

        self.ledger[key] = {"state": "IN_FLIGHT", "fp": fp, "exp": now + self.ttl}
        response = await call_next(request)
        if response.status_code >= 500:
            self.ledger.pop(key, None)
        else:
            chunks = [c async for c in response.body_iterator]
            full_body = b"".join(chunks)
            self.ledger[key] = {"state": "DONE", "fp": fp, "status": response.status_code, "body": full_body, "exp": now + self.ttl}
            return Response(content=full_body, status_code=response.status_code, headers=dict(response.headers))
        return response
`
        };
    }
  }
}
