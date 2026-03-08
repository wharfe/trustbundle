import { describe, expect, it } from 'vitest';
import { jsonlAdapter } from '../jsonl.js';

describe('jsonlAdapter.parse', () => {
  it('parses a basic JSONL line into BundleEvent', async () => {
    const input = '{"timestamp":"2026-03-01T00:00:00Z","action":"test"}';
    const events = await jsonlAdapter.parse(input);
    expect(events).toHaveLength(1);
    expect(events[0]!.source).toBe('jsonl');
    expect(events[0]!.type).toBe('audit_record');
    expect(events[0]!.timestamp).toBe('2026-03-01T00:00:00Z');
    expect(events[0]!.payload).toEqual({ action: 'test' });
  });

  it('auto-generates id when missing', async () => {
    const input = '{"timestamp":"2026-03-01T00:00:00Z"}';
    const events = await jsonlAdapter.parse(input);
    expect(events[0]!.id).toBeTruthy();
    expect(typeof events[0]!.id).toBe('string');
  });

  it('preserves explicit id, source, and type', async () => {
    const input = '{"id":"my-id","source":"custom:foo","type":"risk_event","timestamp":"2026-03-01T00:00:00Z"}';
    const events = await jsonlAdapter.parse(input);
    expect(events[0]!.id).toBe('my-id');
    expect(events[0]!.source).toBe('custom:foo');
    expect(events[0]!.type).toBe('risk_event');
  });

  it('uses explicit payload field when provided', async () => {
    const input = '{"timestamp":"2026-03-01T00:00:00Z","payload":{"key":"val"},"extra":"ignored_in_payload"}';
    const events = await jsonlAdapter.parse(input);
    expect(events[0]!.payload).toEqual({ key: 'val' });
  });

  it('collects remaining fields into payload when payload is absent', async () => {
    const input = '{"timestamp":"2026-03-01T00:00:00Z","foo":"bar","baz":42}';
    const events = await jsonlAdapter.parse(input);
    expect(events[0]!.payload).toEqual({ foo: 'bar', baz: 42 });
  });

  it('preserves metadata when present', async () => {
    const input = '{"timestamp":"2026-03-01T00:00:00Z","metadata":{"tag":"important"}}';
    const events = await jsonlAdapter.parse(input);
    expect(events[0]!.metadata).toEqual({ tag: 'important' });
  });

  it('leaves metadata absent when not provided', async () => {
    const input = '{"timestamp":"2026-03-01T00:00:00Z"}';
    const events = await jsonlAdapter.parse(input);
    expect('metadata' in events[0]!).toBe(false);
  });

  it('skips lines with missing timestamp and warns', async () => {
    const input = '{"action":"no-ts"}\n{"timestamp":"2026-03-01T00:00:00Z","action":"ok"}';
    const events = await jsonlAdapter.parse(input);
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toEqual({ action: 'ok' });
  });

  it('skips lines with invalid JSON and warns', async () => {
    const input = 'not-json\n{"timestamp":"2026-03-01T00:00:00Z"}';
    const events = await jsonlAdapter.parse(input);
    expect(events).toHaveLength(1);
  });

  it('throws when all lines are skipped', async () => {
    const input = '{"no":"timestamp"}\n{"also":"missing"}';
    await expect(jsonlAdapter.parse(input)).rejects.toThrow('All lines were skipped');
  });

  it('handles empty lines gracefully', async () => {
    const input = '\n{"timestamp":"2026-03-01T00:00:00Z"}\n\n';
    const events = await jsonlAdapter.parse(input);
    expect(events).toHaveLength(1);
  });

  it('parses multiple lines', async () => {
    const input = [
      '{"timestamp":"2026-03-01T00:00:00Z","a":1}',
      '{"timestamp":"2026-03-02T00:00:00Z","b":2}',
    ].join('\n');
    const events = await jsonlAdapter.parse(input);
    expect(events).toHaveLength(2);
  });
});

describe('jsonlAdapter.validate', () => {
  it('returns true for non-empty string', () => {
    expect(jsonlAdapter.validate('{"timestamp":"x"}')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(jsonlAdapter.validate('')).toBe(false);
    expect(jsonlAdapter.validate('   ')).toBe(false);
  });

  it('returns false for non-string', () => {
    expect(jsonlAdapter.validate(42)).toBe(false);
    expect(jsonlAdapter.validate(null)).toBe(false);
  });
});
