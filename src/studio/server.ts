/**
 * IdempotentSmith Bento Grid Web Studio Server
 * Embedded visual laboratory featuring Double-Charge Race Simulation,
 * Circular SVG Health Gauge, Payload Fingerprint Tamper Tester,
 * IETF Idempotency-Key Linter, and Multi-Framework Code Generator.
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import http from 'http';
import { RequestFingerprinter } from '../core/fingerprint.js';
import { RaceSimulator } from '../core/idempotencyEngine.js';
import { IdempotencyGenerator } from '../generators/idempotencyGen.js';
import { IdempotencyLinter } from '../linter/idempotencyLinter.js';
import { FrameworkType } from '../types.js';

export class StudioServer {
  private server: http.Server | null = null;

  constructor(private port = 7171) {}

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url || '/', `http://localhost:${this.port}`);

        if (req.method === 'POST' && url.pathname === '/api/simulate-race') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', async () => {
            try {
              const data = body ? JSON.parse(body) : {};
              const workers = Number(data.workers) || 50;
              const amount = Number(data.amount) || 50;
              const result = await RaceSimulator.simulate(workers, amount);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/api/fingerprint') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const original = RequestFingerprinter.compute(data.method || 'POST', data.path || '/v1/charges', data.originalBody || '');
              const retry = RequestFingerprinter.verifyMatch(
                original.fingerprintSha256,
                data.method || 'POST',
                data.path || '/v1/charges',
                data.retryBody || ''
              );
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ original, retry }));
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/api/audit') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const result = IdempotencyLinter.audit(data);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/api/generate') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const fw = (data.framework || 'nextjs') as FrameworkType;
              const result = IdempotencyGenerator.generate(fw, { ttlHours: Number(data.ttlHours) || 24 });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.renderHtml());
      });

      this.server.listen(this.port, () => resolve(this.port));
      this.server.on('error', reject);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) this.server.close(() => resolve());
      else resolve();
    });
  }

  private renderHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>IdempotentSmith Studio | IETF Idempotency-Key & Race Condition Lab</title>
  <style>
    :root {
      --bg: #070a12;
      --card: rgba(15, 23, 42, 0.72);
      --border: rgba(255, 255, 255, 0.08);
      --cyan: #38bdf8;
      --emerald: #10b981;
      --amber: #f59e0b;
      --rose: #f43f5e;
      --violet: #a855f7;
      --text: #f8fafc;
      --muted: #94a3b8;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      background-image:
        radial-gradient(circle at 12% 18%, rgba(56, 189, 248, 0.06), transparent 42%),
        radial-gradient(circle at 88% 82%, rgba(16, 185, 129, 0.05), transparent 42%);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
      min-height: 100vh;
    }
    header {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid var(--border); padding-bottom: 18px; margin-bottom: 24px;
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .badge {
      background: linear-gradient(135deg, var(--cyan), var(--emerald));
      color: #041019; font-weight: 900; padding: 8px 14px; border-radius: 10px;
      font-family: var(--mono); font-size: 16px; box-shadow: 0 0 18px rgba(56, 189, 248, 0.35);
    }
    .brand h1 { font-size: 20px; letter-spacing: -0.4px; }
    .brand p { font-size: 13px; color: var(--muted); }
    .meta-pill {
      font-size: 12px; color: var(--muted); background: rgba(255,255,255,0.03);
      border: 1px solid var(--border); padding: 6px 14px; border-radius: 999px;
    }
    .meta-pill a { color: var(--cyan); text-decoration: none; font-weight: 600; }
    .bento { display: grid; grid-template-columns: repeat(12, 1fr); gap: 18px; }
    .card {
      background: var(--card); backdrop-filter: blur(16px);
      border: 1px solid var(--border); border-radius: 16px; padding: 22px;
      transition: border-color 0.2s;
    }
    .card:hover { border-color: rgba(56, 189, 248, 0.3); }
    .span-8 { grid-column: span 8; }
    .span-4 { grid-column: span 4; }
    .span-6 { grid-column: span 6; }
    .span-12 { grid-column: span 12; }
    .title {
      font-size: 12px; text-transform: uppercase; letter-spacing: 1.1px;
      color: var(--cyan); font-weight: 800; margin-bottom: 6px;
    }
    .desc { font-size: 13px; color: var(--muted); margin-bottom: 16px; }
    button {
      background: linear-gradient(135deg, var(--cyan), var(--emerald));
      color: #041019; border: none; border-radius: 8px; padding: 9px 16px;
      font-weight: 800; font-size: 12px; cursor: pointer;
    }
    button:hover { opacity: 0.9; }
    input, textarea, select {
      width: 100%; background: rgba(0,0,0,0.4); border: 1px solid var(--border);
      color: var(--text); border-radius: 8px; padding: 9px 12px;
      font-family: var(--mono); font-size: 12px; margin-bottom: 10px;
    }
    .sim-bars { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px; }
    .sim-col {
      background: rgba(0,0,0,0.45); border: 1px solid var(--border); border-radius: 12px; padding: 14px;
    }
    .sim-val { font-size: 22px; font-weight: 900; font-family: var(--mono); margin: 6px 0; }
    .gauge-wrap { display: flex; align-items: center; gap: 18px; }
    .issue {
      background: rgba(0,0,0,0.4); border-left: 3px solid var(--rose);
      padding: 9px 12px; border-radius: 0 6px 6px 0; margin-bottom: 8px; font-size: 12px;
    }
    pre code {
      display: block; background: #020409; border: 1px solid var(--border);
      border-radius: 10px; padding: 14px; font-family: var(--mono); font-size: 12px;
      color: #cbd5e1; overflow-x: auto; max-height: 260px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="badge">IS</div>
      <div>
        <h1>IdempotentSmith Studio</h1>
        <p>IETF Idempotency-Key Linter, Double-Charge Race Lab &amp; Payload Fingerprinter</p>
      </div>
    </div>
    <div class="meta-pill">Shortcuts: [R] Re-run Sim &middot; Engineered by <a href="https://jatinsh.netlify.app/" target="_blank">Jatin Sharma</a></div>
  </header>

  <div class="bento">
    <div class="card span-8">
      <div class="title">&#9889; Concurrent Double-Charge Race Simulator</div>
      <p class="desc">Simulates 50 concurrent $50 POST /v1/charges requests with identical Idempotency-Key.</p>
      <button onclick="runRace()">&#9654; Fire 50 Concurrent Retries</button>
      <div class="sim-bars" id="raceResults"></div>
    </div>

    <div class="card span-4">
      <div class="title">&#128737; IETF Compliance Gauge</div>
      <p class="desc">Live score against 12 Idempotency-Key rules.</p>
      <div class="gauge-wrap">
        <svg width="96" height="96" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.08)" stroke-width="10" fill="none"/>
          <circle id="gaugeArc" cx="50" cy="50" r="42" stroke="#10b981" stroke-width="10" fill="none"
            stroke-dasharray="264" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(-90 50 50)"/>
          <text id="gaugeText" x="50" y="55" text-anchor="middle" fill="#f8fafc" font-size="22" font-weight="900">A+</text>
        </svg>
        <div>
          <div style="font-size: 24px; font-weight: 900; font-family: var(--mono);" id="auditScore">100/100</div>
          <div style="font-size: 12px; color: var(--muted);" id="auditStatus">IETF Compliant</div>
        </div>
      </div>
      <div style="margin-top: 12px; display:flex; gap:8px;">
        <button onclick="auditPreset(true)">Test Hardened</button>
        <button style="background: linear-gradient(135deg, var(--rose), var(--amber));" onclick="auditPreset(false)">Test Vulnerable</button>
      </div>
      <div id="auditIssues" style="margin-top: 12px;"></div>
    </div>

    <div class="card span-6">
      <div class="title">&#128273; Canonical JSON &amp; Tamper Fingerprinter</div>
      <p class="desc">Detects Idempotency-Key reuse with altered payloads (HTTP 422) while ignoring key order.</p>
      <label style="font-size:11px; color:var(--muted);">Original Request Body</label>
      <textarea id="origBody" rows="2">{"amount": 50, "currency": "USD", "customer": "cus_101"}</textarea>
      <label style="font-size:11px; color:var(--muted);">Retry Request Body (Reordered vs Mutated)</label>
      <textarea id="retryBody" rows="2">{"customer": "cus_101", "currency": "USD", "amount": 50}</textarea>
      <button onclick="checkFingerprint()">Verify SHA-256 Fingerprint</button>
      <div id="fpOut" style="margin-top: 12px; font-family: var(--mono); font-size: 11px;"></div>
    </div>

    <div class="card span-6">
      <div class="title">&#128229; Multi-Framework Middleware Generator</div>
      <p class="desc">Export atomic lock &amp; SHA-256 fingerprint middleware.</p>
      <div style="display:flex; gap:10px; margin-bottom:10px;">
        <select id="fwSelect" onchange="genCode()">
          <option value="nextjs">Next.js 14/15 App Router</option>
          <option value="express">Express.js Middleware</option>
          <option value="fastify">Fastify Plugin</option>
          <option value="cloudflare">Cloudflare Workers KV</option>
          <option value="hono">Hono Edge Middleware</option>
          <option value="fastapi">FastAPI Python</option>
        </select>
        <button onclick="genCode()">Generate</button>
      </div>
      <pre><code id="codeOut"></code></pre>
    </div>
  </div>

  <script>
    async function runRace() {
      const res = await fetch('/api/simulate-race', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ workers: 50, amount: 50 })
      });
      const d = await res.json();
      const cols = [
        { data: d.unprotected, color: 'var(--rose)' },
        { data: d.naiveReadWrite, color: 'var(--amber)' },
        { data: d.atomicLockFingerprint, color: 'var(--emerald)' }
      ];
      document.getElementById('raceResults').innerHTML = cols.map(c => \`
        <div class="sim-col">
          <div style="font-size:11px; color:var(--muted);">\${c.data.label}</div>
          <div class="sim-val" style="color:\${c.color};">$\${c.data.financialLeakageUsd} Leak</div>
          <div style="font-size:11px; font-family:var(--mono);">
            Executions: \${c.data.ledgerExecutions} | Double Charges: \${c.data.doubleChargeCount}<br>
            Replays: \${c.data.replayedResponses} | 409 Conflicts: \${c.data.conflictResponses}
          </div>
        </div>
      \`).join('');
    }

    async function auditPreset(hardened) {
      const payload = hardened ? {
        method: 'POST', idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        enforcesAtomicLock: true, validatesPayloadFingerprint: true,
        returns409OnInFlight: true, returns422OnMismatch: true,
        ttlHours: 24, caches5xxErrors: false, injectsReplayHeader: true, scopesKeyByUser: true
      } : {
        method: 'POST', idempotencyKey: '123',
        enforcesAtomicLock: false, validatesPayloadFingerprint: false,
        caches5xxErrors: true, ttlHours: 2
      };
      const res = await fetch('/api/audit', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
      });
      const d = await res.json();
      document.getElementById('auditScore').innerText = d.score + '/100';
      document.getElementById('gaugeText').innerText = d.grade;
      const offset = 264 - (264 * d.score / 100);
      const arc = document.getElementById('gaugeArc');
      arc.setAttribute('stroke-dashoffset', String(offset));
      arc.setAttribute('stroke', d.score >= 85 ? '#10b981' : '#f43f5e');
      document.getElementById('auditStatus').innerText = d.isIetfCompliant ? 'IETF Compliant' : 'Vulnerable to Double-Charge';
      document.getElementById('auditIssues').innerHTML = d.issues.slice(0, 3).map(i =>
        \`<div class="issue"><strong>[\${i.code}] \${i.severity}</strong> \${i.message}</div>\`
      ).join('') || '<div style="color:var(--emerald); font-size:12px;">&#10004; Zero IETF compliance defects.</div>';
    }

    async function checkFingerprint() {
      const res = await fetch('/api/fingerprint', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          method: 'POST', path: '/v1/charges',
          originalBody: document.getElementById('origBody').value,
          retryBody: document.getElementById('retryBody').value
        })
      });
      const d = await res.json();
      const col = d.retry.matches ? 'var(--emerald)' : 'var(--rose)';
      const label = d.retry.matches ? 'MATCH (Safe Replay 200 OK)' : 'MISMATCH (Reject HTTP 422)';
      document.getElementById('fpOut').innerHTML = \`
        <div style="background:#020409; padding:10px; border-radius:8px; border:1px solid var(--border);">
          <div>Original SHA-256: <span style="color:var(--cyan);">\${d.original.fingerprintSha256}</span></div>
          <div>Retry SHA-256:    <span style="color:\${col};">\${d.retry.fingerprintSha256}</span></div>
          <div style="margin-top:6px; font-weight:800; color:\${col};">Verdict: \${label}</div>
        </div>
      \`;
    }

    async function genCode() {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ framework: document.getElementById('fwSelect').value, ttlHours: 24 })
      });
      const d = await res.json();
      document.getElementById('codeOut').innerText = d.code;
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        if (document.activeElement.tagName !== 'TEXTAREA' && document.activeElement.tagName !== 'INPUT') runRace();
      }
    });

    window.addEventListener('DOMContentLoaded', () => {
      runRace();
      auditPreset(true);
      checkFingerprint();
      genCode();
    });
  </script>
</body>
</html>`;
  }
}
