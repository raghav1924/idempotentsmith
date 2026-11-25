# IdempotentSmith

> **Developer-First IETF `Idempotency-Key` Linter, Race Condition & Double-Charge Simulator, Payload Fingerprint Engine & Bento Grid Studio.**  
> Built with zero external runtime dependencies in TypeScript 5.9 on Node.js 22.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript: 5.9](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg)](https://www.typescriptlang.org/)
[![Node.js: 22](https://img.shields.io/badge/Node.js-22-339933.svg)](https://nodejs.org/)
[![Author](https://img.shields.io/badge/Architect-Jatin%20Sharma-purple.svg)](https://jatinsh.netlify.app/)

---

## Why IdempotentSmith?

In payment APIs, order pipelines, and AI agent tool-calls, network timeouts and double-clicks trigger automatic client retries. Without atomic `Idempotency-Key` deduplication:
1. **Double-Charges & Duplicate Orders:** Retried `POST` mutations execute multiple times, corrupting financial ledgers.
2. **TOCTOU Race Conditions:** Naive check-then-insert caches allow concurrent requests arriving within milliseconds to slip through before the first write finishes.
3. **Payload Tampering Bugs:** Reusing an `Idempotency-Key` with a modified body silently returns an old response instead of rejecting with `HTTP 422`.
4. **Poisoned Retries:** Caching transient `5xx` errors permanently locks out future retries.

**IdempotentSmith** solves this end-to-end:
- **Atomic In-Flight Lock + Replay Ledger:** Guarantees exactly-once execution, returning `409 Conflict` for concurrent in-flight calls and `Idempotent-Replayed: true` for completed retries.
- **Canonical JSON & SHA-256 Fingerprinter:** Sorts nested JSON keys deterministically so reordered keys replay cleanly while mutated payloads reject with `422 Unprocessable Entity`.
- **Double-Charge Race Simulator:** Benchmarks Unprotected vs TOCTOU Naive vs Atomic Lock across concurrent retry storms.
- **12 IETF `Idempotency-Key` Heuristics (`IDEMP-001` – `IDEMP-012`):** Grades endpoint readiness from `A+` to `F`.
- **Zero-Config Reverse Proxy (Port 8089):** Protects any local HTTP backend out of the box.
- **Bento Grid Web Studio (Port 7171):** Cyberpunk dark-mode visual lab implementing Design Patterns #12, #20, #10, #3, and #24.
- **Multi-Framework Code Generator:** Exports hardened middleware for Next.js 14/15, Express, Fastify, Cloudflare Workers KV, Hono, and FastAPI.

---

## Quickstart

```bash
git clone https://github.com/raghav1924/idempotentsmith.git
cd idempotentsmith
npm run build
npm test
```

### CLI Commands

```bash
# Simulate 50 concurrent $50 retry requests
./bin/idempotentsmith.js simulate --workers 50

# Canonicalize JSON and compute SHA-256 fingerprint
./bin/idempotentsmith.js fingerprint '{"b":2,"a":1}'

# Audit endpoint config against IETF rules
./bin/idempotentsmith.js audit

# Launch Bento Grid Visual Studio on http://localhost:7171
./bin/idempotentsmith.js studio --port 7171

# Start local idempotency reverse proxy on http://localhost:8089
./bin/idempotentsmith.js proxy --port 8089

# Generate framework middleware
./bin/idempotentsmith.js generate nextjs
```

---

## License

MIT License. Engineered by **[Jatin Sharma](https://jatinsh.netlify.app/)**.  
GitHub: [@raghav1924](https://github.com/raghav1924)
