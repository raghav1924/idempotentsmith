/**
 * IdempotentSmith Request Fingerprinter & JSON Canonicalizer
 * Computes deterministic SHA-256 fingerprints across re-ordered JSON payloads
 * to detect Idempotency-Key reuse with mutated parameters (HTTP 422).
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import { createHash } from 'crypto';
import { FingerprintResult } from '../types.js';

export class RequestFingerprinter {
  /**
   * Recursively canonicalize any JSON-compatible value with sorted object keys
   */
  static canonicalizeValue(val: any): any {
    if (val === null || typeof val !== 'object') {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map((item) => this.canonicalizeValue(item));
    }
    const sorted: Record<string, any> = {};
    const keys = Object.keys(val).sort();
    for (const k of keys) {
      if (val[k] !== undefined) {
        sorted[k] = this.canonicalizeValue(val[k]);
      }
    }
    return sorted;
  }

  /**
   * Canonicalize raw JSON string or plain text body
   */
  static canonicalizeBody(rawBody: string): string {
    const trimmed = rawBody.trim();
    if (!trimmed) return '';
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(this.canonicalizeValue(parsed));
    } catch {
      return trimmed;
    }
  }

  /**
   * Compute deterministic SHA-256 request fingerprint from method, path, and body
   */
  static compute(method: string, path: string, rawBody = ''): FingerprintResult {
    const normMethod = method.toUpperCase();
    const normPath = path.trim() || '/';
    const canonicalBody = this.canonicalizeBody(rawBody);
    const payload = `${normMethod}:${normPath}:${canonicalBody}`;
    const fingerprintSha256 = createHash('sha256').update(payload).digest('hex');

    return {
      method: normMethod,
      path: normPath,
      canonicalBody,
      fingerprintSha256
    };
  }

  /**
   * Compare an incoming request against a stored SHA-256 fingerprint
   */
  static verifyMatch(expectedSha256: string, method: string, path: string, rawBody = ''): FingerprintResult {
    const computed = this.compute(method, path, rawBody);
    return {
      ...computed,
      matches: computed.fingerprintSha256 === expectedSha256
    };
  }
}
