import { describe, expect, it } from 'vitest';
import type { BundleEvent } from '../types.js';
import {
  buildBundle,
  canonicalize,
  computeDigest,
  verifyBundle,
} from '../engine.js';

function makeEvent(overrides: Partial<BundleEvent> = {}): BundleEvent {
  return {
    id: 'evt-001',
    source: 'jsonl',
    type: 'audit_record',
    timestamp: '2026-03-01T00:00:00.000Z',
    payload: { action: 'test' },
    ...overrides,
  };
}

describe('canonicalize', () => {
  it('sorts object keys recursively', () => {
    const event = makeEvent({ payload: { z: 1, a: 2 } });
    const json = canonicalize([event]);
    const parsed = JSON.parse(json) as BundleEvent[];
    const keys = Object.keys(parsed[0]!.payload);
    expect(keys).toEqual(['a', 'z']);
  });

  it('preserves array element order', () => {
    const event = makeEvent({ payload: { items: [3, 1, 2] } });
    const json = canonicalize([event]);
    const parsed = JSON.parse(json) as BundleEvent[];
    expect((parsed[0]!.payload as { items: number[] }).items).toEqual([
      3, 1, 2,
    ]);
  });

  it('drops undefined values', () => {
    const event = makeEvent();
    // metadata is undefined by default (not set in makeEvent)
    const json = canonicalize([event]);
    expect(json).not.toContain('metadata');
  });

  it('produces minified JSON (no whitespace)', () => {
    const event = makeEvent();
    const json = canonicalize([event]);
    expect(json).not.toMatch(/\n/);
    expect(json).not.toMatch(/  /);
  });
});

describe('computeDigest', () => {
  it('returns sha256 prefixed value', () => {
    const digest = computeDigest([makeEvent()]);
    expect(digest.algorithm).toBe('sha256');
    expect(digest.value).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(digest.covers).toBe('events');
  });

  it('produces identical digest for identical events', () => {
    const events = [makeEvent()];
    const d1 = computeDigest(events);
    const d2 = computeDigest(events);
    expect(d1.value).toBe(d2.value);
  });

  it('produces different digest when events change', () => {
    const d1 = computeDigest([makeEvent({ payload: { action: 'a' } })]);
    const d2 = computeDigest([makeEvent({ payload: { action: 'b' } })]);
    expect(d1.value).not.toBe(d2.value);
  });
});

describe('buildBundle', () => {
  it('returns a valid TrustBundle', () => {
    const bundle = buildBundle([makeEvent()]);
    expect(bundle.schema_version).toBe('0.1');
    expect(bundle.bundle_id).toBeTruthy();
    expect(bundle.event_count).toBe(1);
    expect(bundle.events).toHaveLength(1);
    expect(bundle.digest.value).toMatch(/^sha256:/);
  });

  it('sorts events by timestamp ascending', () => {
    const e1 = makeEvent({ id: 'a', timestamp: '2026-03-02T00:00:00Z' });
    const e2 = makeEvent({ id: 'b', timestamp: '2026-03-01T00:00:00Z' });
    const bundle = buildBundle([e1, e2]);
    expect(bundle.events[0]!.id).toBe('b');
    expect(bundle.events[1]!.id).toBe('a');
  });

  it('includes optional run_id and description', () => {
    const bundle = buildBundle([makeEvent()], {
      runId: 'run-123',
      description: 'test bundle',
    });
    expect(bundle.run_id).toBe('run-123');
    expect(bundle.description).toBe('test bundle');
  });

  it('omits run_id and description when not provided', () => {
    const bundle = buildBundle([makeEvent()]);
    expect('run_id' in bundle).toBe(false);
    expect('description' in bundle).toBe(false);
  });
});

describe('verifyBundle', () => {
  it('returns valid for an unmodified bundle', () => {
    const bundle = buildBundle([makeEvent()]);
    const result = verifyBundle(bundle);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('detects digest mismatch when events are tampered', () => {
    const bundle = buildBundle([makeEvent()]);
    bundle.events[0]!.payload = { action: 'tampered' };
    const result = verifyBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('DIGEST_MISMATCH');
  });

  it('detects event_count mismatch', () => {
    const bundle = buildBundle([makeEvent()]);
    bundle.event_count = 999;
    const result = verifyBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('EVENT_COUNT_MISMATCH');
  });

  it('rejects unsupported schema version', () => {
    const bundle = buildBundle([makeEvent()]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bundle as any).schema_version = '99.0';
    const result = verifyBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('UNSUPPORTED_SCHEMA_VERSION');
  });

  it('returns correct metadata in result', () => {
    const bundle = buildBundle([makeEvent()]);
    const result = verifyBundle(bundle);
    expect(result.bundle_id).toBe(bundle.bundle_id);
    expect(result.event_count).toBe(1);
    expect(result.digest_algorithm).toBe('sha256');
    expect(result.verified_at).toBeTruthy();
  });
});
