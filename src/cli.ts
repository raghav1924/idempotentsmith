#!/usr/bin/env node
/**
 * IdempotentSmith CLI Interface
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import { RequestFingerprinter } from './core/fingerprint.js';
import { RaceSimulator } from './core/idempotencyEngine.js';
import { IdempotencyLinter } from './linter/idempotencyLinter.js';
import { IdempotencyProxy } from './proxy/idempotencyProxy.js';
import { IdempotencyGenerator } from './generators/idempotencyGen.js';
import { StudioServer } from './studio/server.js';
import { FrameworkType } from './types.js';

const VERSION = '1.0.0';

function printBanner() {
  console.log(`
\x1b[36m   ___    __                            __             __  _____           _ __  __  \x1b[0m
\x1b[36m  /  _/___/ /__  ____ ___  ____  ____  / /____  ____  / /_/ ___/____ ___  (_) /_/ /_ \x1b[0m
\x1b[36m  / // __  / _ \\/ __ \`__ \\/ __ \\/ __ \\/ __/ _ \\/ __ \\/ __/\\__ \\/ __ \`__ \\/ / __/ __ \\\x1b[0m
\x1b[36m_/ // /_/ /  __/ / / / / / /_/ / /_/ / /_/  __/ / / / /_ ___/ / / / / / / / /_/ / / /\x1b[0m
\x1b[36m/___/\\__,_/\\___/_/ /_/ /_/ .___/\\____/\\__/\\___/_/ /_/\\__//____/_/ /_/ /_/_/\\__/_/ /_/ \x1b[0m
\x1b[90m  v${VERSION} | IETF Idempotency-Key Linter & Double-Charge Race Lab\x1b[0m
\x1b[90m  Architect: Jatin Sharma (https://jatinsh.netlify.app/)\x1b[0m
`);
}

function printHelp() {
  printBanner();
  console.log(`\x1b[1mUSAGE:\x1b[0m
  idempotentsmith <command> [options]

\x1b[1mCOMMANDS:\x1b[0m
  \x1b[32msimulate\x1b[0m                 Simulate concurrent double-charge race conditions
  \x1b[32maudit\x1b[0m                    Audit endpoint config against 12 IETF Idempotency-Key rules
  \x1b[32mfingerprint <json>\x1b[0m       Canonicalize JSON body and compute SHA-256 request fingerprint
  \x1b[32mproxy\x1b[0m                    Start zero-config idempotency reverse proxy (port 8089)
  \x1b[32mgenerate <framework>\x1b[0m     Generate middleware (nextjs, express, fastify, cloudflare, hono, fastapi)
  \x1b[32mstudio\x1b[0m                   Launch Bento Grid Web Studio on http://localhost:7171
  \x1b[32mversion\x1b[0m                  Print version number
  \x1b[32mhelp\x1b[0m                     Display this help message
`);
}

async function handleSimulate(args: string[]) {
  const wIdx = args.indexOf('--workers');
  const workers = wIdx !== -1 && args[wIdx + 1] ? parseInt(args[wIdx + 1], 10) : 50;
  const res = await RaceSimulator.simulate(workers, 50);

  console.log(`\n\x1b[1m=== DOUBLE-CHARGE RACE SIMULATION (${workers} Concurrent $50 Retries) ===\x1b[0m\n`);
  console.log(`\x1b[31m1. ${res.unprotected.label}:\x1b[0m`);
  console.log(`   - Executions: ${res.unprotected.ledgerExecutions} | Double Charges: ${res.unprotected.doubleChargeCount} | Leakage: $${res.unprotected.financialLeakageUsd}`);
  console.log(`\x1b[33m2. ${res.naiveReadWrite.label}:\x1b[0m`);
  console.log(`   - Executions: ${res.naiveReadWrite.ledgerExecutions} | Double Charges: ${res.naiveReadWrite.doubleChargeCount} | Leakage: $${res.naiveReadWrite.financialLeakageUsd}`);
  console.log(`\x1b[32m3. ${res.atomicLockFingerprint.label}:\x1b[0m`);
  console.log(`   - Executions: ${res.atomicLockFingerprint.ledgerExecutions} | Double Charges: ${res.atomicLockFingerprint.doubleChargeCount} | Leakage: $${res.atomicLockFingerprint.financialLeakageUsd}`);
  console.log(`   - Replayed: ${res.atomicLockFingerprint.replayedResponses} | 409 Conflicts: ${res.atomicLockFingerprint.conflictResponses}\n`);
}

function handleAudit(args: string[]) {
  const keyIdx = args.indexOf('--key');
  const idempotencyKey = keyIdx !== -1 ? args[keyIdx + 1] : '550e8400-e29b-41d4-a716-446655440000';
  const result = IdempotencyLinter.audit({
    method: 'POST',
    idempotencyKey,
    enforcesAtomicLock: true,
    validatesPayloadFingerprint: true,
    returns409OnInFlight: true,
    returns422OnMismatch: true,
    ttlHours: 24,
    caches5xxErrors: false,
    injectsReplayHeader: true,
    scopesKeyByUser: true
  });
  console.log(`\nGrade: \x1b[32m${result.grade}\x1b[0m (${result.score}/100) | IETF Compliant: ${result.isIetfCompliant}\n`);
}

function handleFingerprint(args: string[]) {
  const raw = args[1] || '{"amount":50,"currency":"USD"}';
  const fp = RequestFingerprinter.compute('POST', '/v1/charges', raw);
  console.log(`\nCanonical Body: ${fp.canonicalBody}`);
  console.log(`SHA-256:        \x1b[36m${fp.fingerprintSha256}\x1b[0m\n`);
}

async function handleProxy(args: string[]) {
  const pIdx = args.indexOf('--port');
  const port = pIdx !== -1 && args[pIdx + 1] ? parseInt(args[pIdx + 1], 10) : 8089;
  const proxy = new IdempotencyProxy({ port });
  await proxy.start();
  printBanner();
  console.log(`\x1b[32m✔ IdempotencyProxy listening on http://localhost:${port}\x1b[0m`);
}

function handleGenerate(args: string[]) {
  const fw = (args[1] || 'nextjs').toLowerCase() as FrameworkType;
  const mw = IdempotencyGenerator.generate(fw);
  console.log(`\n# ${mw.title} (${mw.filename})\n`);
  console.log(mw.code);
}

async function handleStudio(args: string[]) {
  const pIdx = args.indexOf('--port');
  const port = pIdx !== -1 && args[pIdx + 1] ? parseInt(args[pIdx + 1], 10) : 7171;
  const studio = new StudioServer(port);
  await studio.start();
  printBanner();
  console.log(`\x1b[32m✔ IdempotentSmith Studio active at http://localhost:${port}\x1b[0m`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'help';
  switch (cmd) {
    case 'simulate': await handleSimulate(args); break;
    case 'audit': handleAudit(args); break;
    case 'fingerprint': handleFingerprint(args); break;
    case 'proxy': await handleProxy(args); break;
    case 'generate': handleGenerate(args); break;
    case 'studio': await handleStudio(args); break;
    case 'version': case '-v': case '--version': console.log(`v${VERSION}`); break;
    default: printHelp(); break;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
