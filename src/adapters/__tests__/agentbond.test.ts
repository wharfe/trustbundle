import { describe, expect, it } from 'vitest';
import { agentbondAdapter } from '../agentbond.js';

function makeRecords(...overrides: Record<string, unknown>[]): string {
  const base = { id: 'rec-001', timestamp: '2026-03-01T00:00:00Z', layer: 'authorization' };
  return JSON.stringify(overrides.map((o) => ({ ...base, ...o })));
}

describe('agentbondAdapter.parse', () => {
  it('parses a basic AuditRecord into BundleEvent', async () => {
    const input = makeRecords({ layer: 'authorization', action: 'allow' });
    const events = await agentbondAdapter.parse(input);
    expect(events).toHaveLength(1);
    expect(events[0]!.source).toBe('agentbond');
    expect(events[0]!.type).toBe('authorization_decision');
    expect(events[0]!.id).toBe('rec-001');
    expect(events[0]!.payload).toHaveProperty('action', 'allow');
  });

  it('maps layer "budget" to "budget_consumed"', async () => {
    const events = await agentbondAdapter.parse(makeRecords({ layer: 'budget' }));
    expect(events[0]!.type).toBe('budget_consumed');
  });

  it('maps layer "intent" to "audit_record"', async () => {
    const events = await agentbondAdapter.parse(makeRecords({ layer: 'intent' }));
    expect(events[0]!.type).toBe('audit_record');
  });

  it('maps layer "contract" to "audit_record"', async () => {
    const events = await agentbondAdapter.parse(makeRecords({ layer: 'contract' }));
    expect(events[0]!.type).toBe('audit_record');
  });

  it('maps layer "settlement" to "audit_record"', async () => {
    const events = await agentbondAdapter.parse(makeRecords({ layer: 'settlement' }));
    expect(events[0]!.type).toBe('audit_record');
  });

  it('falls back to "audit_record" for unknown layer', async () => {
    const events = await agentbondAdapter.parse(makeRecords({ layer: 'unknown_layer' }));
    expect(events[0]!.type).toBe('audit_record');
  });

  it('stores entire AuditRecord as payload', async () => {
    const input = makeRecords({ extra: 'data', nested: { deep: true } });
    const events = await agentbondAdapter.parse(input);
    expect(events[0]!.payload).toHaveProperty('extra', 'data');
    expect(events[0]!.payload).toHaveProperty('nested');
    expect(events[0]!.payload).toHaveProperty('id', 'rec-001');
  });

  it('does not set metadata', async () => {
    const events = await agentbondAdapter.parse(makeRecords({}));
    expect('metadata' in events[0]!).toBe(false);
  });

  it('skips records with missing id', async () => {
    const input = JSON.stringify([
      { timestamp: '2026-03-01T00:00:00Z', layer: 'authorization' },
      { id: 'ok', timestamp: '2026-03-01T00:00:00Z', layer: 'budget' },
    ]);
    const events = await agentbondAdapter.parse(input);
    expect(events).toHaveLength(1);
    expect(events[0]!.id).toBe('ok');
  });

  it('skips records with missing timestamp', async () => {
    const input = JSON.stringify([
      { id: 'no-ts', layer: 'authorization' },
      { id: 'ok', timestamp: '2026-03-01T00:00:00Z', layer: 'budget' },
    ]);
    const events = await agentbondAdapter.parse(input);
    expect(events).toHaveLength(1);
    expect(events[0]!.id).toBe('ok');
  });

  it('throws when all records are skipped', async () => {
    const input = JSON.stringify([{ layer: 'authorization' }]);
    await expect(agentbondAdapter.parse(input)).rejects.toThrow('All records were skipped');
  });

  it('throws on non-array JSON', async () => {
    await expect(agentbondAdapter.parse('{"not":"array"}')).rejects.toThrow('must be a JSON array');
  });

  it('throws on invalid JSON', async () => {
    await expect(agentbondAdapter.parse('not json')).rejects.toThrow('Failed to parse');
  });

  it('parses multiple records', async () => {
    const input = makeRecords(
      { id: 'a', layer: 'authorization' },
      { id: 'b', layer: 'budget' },
    );
    const events = await agentbondAdapter.parse(input);
    expect(events).toHaveLength(2);
  });
});

describe('agentbondAdapter.validate', () => {
  it('returns true for valid JSON array string', () => {
    expect(agentbondAdapter.validate('[{"id":"x"}]')).toBe(true);
  });

  it('returns false for non-array JSON', () => {
    expect(agentbondAdapter.validate('{"not":"array"}')).toBe(false);
  });

  it('returns false for invalid JSON', () => {
    expect(agentbondAdapter.validate('not json')).toBe(false);
  });

  it('returns false for non-string', () => {
    expect(agentbondAdapter.validate(42)).toBe(false);
  });
});
