/**
 * IdempotentSmith Zero-Config Idempotency Reverse Proxy
 * Protects mutating POST/PATCH endpoints with atomic locking, SHA-256 payload fingerprinting,
 * 409 Conflict / 422 Mismatch guards, and deterministic response replay.
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import http from 'http';
import { IdempotencyLedger } from '../core/idempotencyEngine.js';

export interface ProxyOptions {
  port?: number;
  targetUrl?: string;
  ttlMs?: number;
  requireKey?: boolean;
}

export interface ProxyStats {
  totalRequests: number;
  executed: number;
  replayed: number;
  conflicts409: number;
  mismatches422: number;
  ledgerSize: number;
}

export class IdempotencyProxy {
  private server: http.Server | null = null;
  public readonly ledger: IdempotencyLedger;
  private port: number;
  private stats: ProxyStats = {
    totalRequests: 0,
    executed: 0,
    replayed: 0,
    conflicts409: 0,
    mismatches422: 0,
    ledgerSize: 0
  };

  constructor(private options: ProxyOptions = {}) {
    this.port = options.port || 8089;
    this.ledger = new IdempotencyLedger(options.ttlMs || 24 * 60 * 60 * 1000);
  }

  getStats(): ProxyStats {
    return {
      ...this.stats,
      ledgerSize: this.ledger.size()
    };
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        if (req.url === '/__idempotentsmith/stats') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.getStats(), null, 2));
          return;
        }

        if (req.url === '/__idempotentsmith/ledger') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.ledger.getAll(), null, 2));
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => (body += chunk));
        req.on('end', async () => {
          this.stats.totalRequests++;
          const method = (req.method || 'GET').toUpperCase();
          const path = req.url || '/';
          const rawKey = req.headers['idempotency-key'];
          const idemKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;

          // Only guard mutating POST/PATCH methods
          if ((method !== 'POST' && method !== 'PATCH') || (!idemKey && !this.options.requireKey)) {
            const resp = await this.forwardToOrigin(method, path, body);
            res.writeHead(resp.statusCode, { ...resp.headers, 'X-Idempotency-Status': 'BYPASSED' });
            res.end(resp.body);
            return;
          }

          if (!idemKey) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Bad Request', message: 'Missing required Idempotency-Key header' }));
            return;
          }

          const check = this.ledger.acquire<string>(idemKey, method, path, body);

          if (check.action === 'UNPROCESSABLE_MISMATCH') {
            this.stats.mismatches422++;
            res.writeHead(422, { 'Content-Type': 'application/json', ...check.headers });
            res.end(JSON.stringify({
              error: 'Unprocessable Entity',
              message: 'Idempotency-Key reused with a different request payload fingerprint.',
              expectedFingerprint: check.record?.fingerprintSha256,
              receivedFingerprint: check.fingerprintSha256
            }));
            return;
          }

          if (check.action === 'CONFLICT_IN_FLIGHT') {
            this.stats.conflicts409++;
            res.writeHead(409, { 'Content-Type': 'application/json', ...check.headers });
            res.end(JSON.stringify({
              error: 'Conflict',
              message: 'A request with this Idempotency-Key is currently in-flight. Retry shortly.'
            }));
            return;
          }

          if (check.action === 'REPLAY' && check.record) {
            this.stats.replayed++;
            res.writeHead(check.record.statusCode, {
              ...check.record.responseHeaders,
              ...check.headers
            });
            res.end(check.record.responseBody || '');
            return;
          }

          // EXECUTE
          this.stats.executed++;
          try {
            const originRes = await this.forwardToOrigin(method, path, body);
            if (originRes.statusCode >= 500) {
              this.ledger.releaseOnFailure(idemKey);
            } else {
              this.ledger.commit(idemKey, originRes.statusCode, originRes.headers, originRes.body);
            }
            res.writeHead(originRes.statusCode, { ...originRes.headers, ...check.headers });
            res.end(originRes.body);
          } catch (err: any) {
            this.ledger.releaseOnFailure(idemKey);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
          }
        });
      });

      this.server.listen(this.port, () => resolve(this.port));
      this.server.on('error', reject);
    });
  }

  private async forwardToOrigin(
    method: string,
    path: string,
    body: string
  ): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
    if (this.options.targetUrl) {
      return new Promise((resolve, reject) => {
        const target = new URL(path, this.options.targetUrl);
        const req = http.request(
          target.toString(),
          { method, headers: { 'Content-Type': 'application/json' } },
          (resp: http.IncomingMessage) => {
            let data = '';
            resp.on('data', (c: any) => (data += c));
            resp.on('end', () => {
              const headers: Record<string, string> = {};
              for (const [k, v] of Object.entries(resp.headers)) {
                if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(', ') : String(v);
              }
              resolve({ statusCode: resp.statusCode || 200, headers, body: data });
            });
          }
        );
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
      });
    }

    // Built-in mock payment/order ledger origin
    await new Promise((r) => setTimeout(r, 15));
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'CHARGED',
        transactionId: 'tx_' + Math.random().toString(36).slice(2, 10),
        method,
        path,
        timestamp: new Date().toISOString(),
        provider: 'IdempotentSmith Mock Ledger'
      })
    };
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) this.server.close(() => resolve());
      else resolve();
    });
  }
}
