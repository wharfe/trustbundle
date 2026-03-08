import { createHash, randomUUID } from 'node:crypto';
import type {
  BundleDigest,
  BundleEvent,
  IsoDatetime,
  TrustBundle,
  VerifyResult,
} from './types.js';

/**
 * Recursively sort object keys in Unicode code point order.
 * Array element order is preserved.
 * undefined values are dropped.
 */
function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== undefined) {
      sorted[key] = sortKeys(v);
    }
  }
  return sorted;
}

/**
 * Convert events to canonical JSON string.
 * - Recursively sort object keys by Unicode code point order
 * - Drop undefined values
 * - Minified (no whitespace)
 *
 * Used by both buildBundle and verifyBundle to ensure identical digest computation.
 */
export function canonicalize(events: BundleEvent[]): string {
  return JSON.stringify(sortKeys(events));
}

/**
 * Compute SHA-256 digest over the canonical JSON of events.
 */
export function computeDigest(events: BundleEvent[]): BundleDigest {
  const canonical = canonicalize(events);
  const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');

  return {
    algorithm: 'sha256',
    value: `sha256:${hash}`,
    covers: 'events',
    computed_at: new Date().toISOString() as IsoDatetime,
  };
}

export interface BuildBundleOptions {
  runId?: string;
  description?: string;
}

/**
 * Build a TrustBundle from a list of BundleEvents.
 * Events are sorted by timestamp (ascending) before bundling.
 */
export function buildBundle(
  events: BundleEvent[],
  options: BuildBundleOptions = {},
): TrustBundle {
  const sorted = [...events].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );

  const digest = computeDigest(sorted);

  return {
    bundle_id: randomUUID(),
    schema_version: '0.1',
    created_at: new Date().toISOString() as IsoDatetime,
    ...(options.runId !== undefined && { run_id: options.runId }),
    ...(options.description !== undefined && { description: options.description }),
    events: sorted,
    event_count: sorted.length,
    digest,
  };
}

/**
 * Verify a TrustBundle by re-computing the digest and comparing.
 */
export function verifyBundle(bundle: TrustBundle): VerifyResult {
  const now = new Date().toISOString() as IsoDatetime;
  const base = {
    bundle_id: bundle.bundle_id,
    event_count: bundle.events.length,
    digest_algorithm: bundle.digest.algorithm,
    verified_at: now,
  };

  // Check schema version
  if (bundle.schema_version !== '0.1') {
    return { ...base, valid: false, reason: 'UNSUPPORTED_SCHEMA_VERSION' };
  }

  // Validate digest metadata
  if (bundle.digest.algorithm !== 'sha256' || bundle.digest.covers !== 'events') {
    return { ...base, valid: false, reason: 'SCHEMA_INVALID' };
  }

  // Check event_count matches events.length
  if (bundle.event_count !== bundle.events.length) {
    return { ...base, valid: false, reason: 'EVENT_COUNT_MISMATCH' };
  }

  // Re-compute digest and compare
  const canonical = canonicalize(bundle.events);
  const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');
  const recomputed = `sha256:${hash}`;

  if (recomputed !== bundle.digest.value) {
    return { ...base, valid: false, reason: 'DIGEST_MISMATCH' };
  }

  return { ...base, valid: true };
}
