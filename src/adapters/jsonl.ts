import { randomUUID } from 'node:crypto';
import type { BundleAdapter, BundleEvent, BundleEventSource, BundleEventType } from '../core/types.js';

const KNOWN_FIELDS = new Set(['id', 'timestamp', 'source', 'type', 'payload', 'metadata']);

export const jsonlAdapter: BundleAdapter = {
  source: 'jsonl',

  async parse(input: string): Promise<BundleEvent[]> {
    const lines = input.split('\n');
    const events: BundleEvent[] = [];
    let parsedCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (line === '') continue;

      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(line) as Record<string, unknown>;
      } catch {
        console.warn(`[jsonl] Skipping line ${i + 1}: JSON parse error`);
        continue;
      }
      parsedCount++;

      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        console.warn(`[jsonl] Skipping line ${i + 1}: not a JSON object`);
        continue;
      }

      // timestamp is required
      if (!raw['timestamp'] || typeof raw['timestamp'] !== 'string') {
        console.warn(`[jsonl] Skipping line ${i + 1}: missing or invalid timestamp`);
        continue;
      }

      // Build payload from remaining fields if payload is not explicitly provided
      let payload: Record<string, unknown>;
      if (raw['payload'] !== undefined && typeof raw['payload'] === 'object' && raw['payload'] !== null) {
        payload = raw['payload'] as Record<string, unknown>;
      } else {
        payload = {};
        for (const [key, value] of Object.entries(raw)) {
          if (!KNOWN_FIELDS.has(key)) {
            payload[key] = value;
          }
        }
      }

      const event: BundleEvent = {
        id: typeof raw['id'] === 'string' ? raw['id'] : randomUUID(),
        source: (typeof raw['source'] === 'string' ? raw['source'] : 'jsonl') as BundleEventSource,
        type: (typeof raw['type'] === 'string' ? raw['type'] : 'audit_record') as BundleEventType,
        timestamp: raw['timestamp'] as string,
        payload,
      };

      // metadata: keep if present, otherwise leave absent (do not set to null)
      if (raw['metadata'] !== undefined && raw['metadata'] !== null && typeof raw['metadata'] === 'object') {
        event.metadata = raw['metadata'] as Record<string, unknown>;
      }

      events.push(event);
    }

    if (parsedCount > 0 && events.length === 0) {
      throw new Error('[jsonl] All lines were skipped — no valid events produced');
    }

    return events;
  },

  validate(raw: unknown): boolean {
    return typeof raw === 'string' && raw.trim().length > 0;
  },
};
