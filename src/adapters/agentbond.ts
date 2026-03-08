import type { BundleAdapter, BundleEvent, BundleEventType } from '../core/types.js';

interface AuditRecord {
  id?: unknown;
  timestamp?: unknown;
  layer?: unknown;
  [key: string]: unknown;
}

function mapLayerToEventType(layer: unknown): BundleEventType {
  switch (layer) {
    case 'authorization':
      return 'authorization_decision';
    case 'budget':
      return 'budget_consumed';
    case 'intent':
    case 'contract':
    case 'settlement':
      return 'audit_record';
    default:
      return 'audit_record';
  }
}

export const agentbondAdapter: BundleAdapter = {
  source: 'agentbond',

  async parse(input: string): Promise<BundleEvent[]> {
    let records: AuditRecord[];
    try {
      records = JSON.parse(input) as AuditRecord[];
    } catch {
      throw new Error('[agentbond] Failed to parse input as JSON');
    }

    if (!Array.isArray(records)) {
      throw new Error('[agentbond] Input must be a JSON array of AuditRecords');
    }

    const events: BundleEvent[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i]!;

      if (!record['id'] || typeof record['id'] !== 'string') {
        console.warn(`[agentbond] Skipping record at index ${i}: missing or invalid id`);
        continue;
      }

      if (!record['timestamp'] || typeof record['timestamp'] !== 'string') {
        console.warn(`[agentbond] Skipping record at index ${i}: missing or invalid timestamp`);
        continue;
      }

      events.push({
        id: record['id'],
        source: 'agentbond',
        type: mapLayerToEventType(record['layer']),
        timestamp: record['timestamp'],
        payload: record as Record<string, unknown>,
      });
    }

    if (records.length > 0 && events.length === 0) {
      throw new Error('[agentbond] All records were skipped — no valid events produced');
    }

    return events;
  },

  validate(raw: unknown): boolean {
    if (typeof raw !== 'string') return false;
    try {
      return Array.isArray(JSON.parse(raw));
    } catch {
      return false;
    }
  },
};
