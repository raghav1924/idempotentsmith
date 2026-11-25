/**
 * IdempotentSmith Core Type Definitions
 * IETF draft-ietf-httpapi-idempotency-key-header & Distributed Deduplication Engine
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

export type IdempotencyStrategy = 'unprotected' | 'naive-read-write' | 'atomic-lock-fingerprint';

export type LedgerEntryState = 'IN_FLIGHT' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord<T = any> {
  key: string;
  fingerprintSha256: string;
  method: string;
  path: string;
  state: LedgerEntryState;
  statusCode: number;
  responseHeaders: Record<string, string>;
  responseBody: T | null;
  createdAt: number;
  expiresAt: number;
  replayCount: number;
}

export interface FingerprintResult {
  method: string;
  path: string;
  canonicalBody: string;
  fingerprintSha256: string;
  matches?: boolean;
}

export interface IdempotencyCheckResult<T = any> {
  action: 'EXECUTE' | 'REPLAY' | 'CONFLICT_IN_FLIGHT' | 'UNPROCESSABLE_MISMATCH';
  statusCode: number;
  replayed: boolean;
  fingerprintSha256: string;
  record?: IdempotencyRecord<T>;
  headers: Record<string, string>;
}

export interface RaceSimulationStrategyResult {
  strategy: IdempotencyStrategy;
  label: string;
  concurrentWorkers: number;
  ledgerExecutions: number;
  doubleChargeCount: number;
  financialLeakageUsd: number;
  replayedResponses: number;
  conflictResponses: number;
  avgLatencyMs: number;
}

export interface RaceSimulationResult {
  chargeAmountUsd: number;
  concurrentWorkers: number;
  unprotected: RaceSimulationStrategyResult;
  naiveReadWrite: RaceSimulationStrategyResult;
  atomicLockFingerprint: RaceSimulationStrategyResult;
  savingsUsd: number;
}

export type IssueSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type IdempotencySection = 'HEADER' | 'LOCKING' | 'FINGERPRINT' | 'RETENTION' | 'ERRORS';

export interface IdempotencyIssue {
  code: string;
  severity: IssueSeverity;
  section: IdempotencySection;
  message: string;
  recommendation: string;
}

export interface IdempotencyAuditInput {
  method: string;
  idempotencyKey?: string;
  enforcesAtomicLock?: boolean;
  validatesPayloadFingerprint?: boolean;
  returns409OnInFlight?: boolean;
  returns422OnMismatch?: boolean;
  ttlHours?: number;
  caches5xxErrors?: boolean;
  injectsReplayHeader?: boolean;
  scopesKeyByUser?: boolean;
}

export interface IdempotencyAuditResult {
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  issues: IdempotencyIssue[];
  isIetfCompliant: boolean;
  summary: {
    keyPresent: boolean;
    keyFormatValid: boolean;
    hasAtomicLock: boolean;
    hasFingerprint: boolean;
    ttlHours: number;
  };
}

export type FrameworkType = 'nextjs' | 'express' | 'fastify' | 'cloudflare' | 'hono' | 'fastapi';

export interface GeneratedIdempotencyCode {
  framework: FrameworkType;
  title: string;
  filename: string;
  code: string;
  instructions: string;
}
