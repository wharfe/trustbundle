import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';
import type { BundleEventType, TrustBundle } from '../core/types.js';
import { verifyBundle } from '../core/engine.js';

interface ShowOptions {
  format?: string;
}

interface ShowSummary {
  bundle_id: string;
  schema_version: string;
  created_at: string;
  run_id?: string;
  event_count: number;
  event_types: Record<string, number>;
  timeline: {
    first?: string;
    last?: string;
  };
  digest_status: 'valid' | 'invalid' | 'unverifiable';
}

export function registerShow(program: Command): void {
  program
    .command('show')
    .description('Display a human-readable bundle summary')
    .argument('<bundle>', 'Path to bundle JSON file')
    .option('--format <format>', 'Output format: text (default) or json')
    .action(async (bundlePath: string, options: ShowOptions) => {
      let content: string;
      try {
        content = await readFile(bundlePath, 'utf8');
      } catch {
        console.error(`Error: cannot read file: ${bundlePath}`);
        process.exit(2);
      }

      let bundle: TrustBundle;
      try {
        bundle = JSON.parse(content) as TrustBundle;
      } catch {
        console.error(`Error: invalid JSON in ${bundlePath}`);
        process.exit(2);
        return;
      }

      // Basic schema check
      if (!bundle.bundle_id || !Array.isArray(bundle.events) || !bundle.digest) {
        console.error(`Error: invalid bundle schema in ${bundlePath}`);
        process.exit(2);
        return;
      }

      // Compute digest status (show continues even if invalid)
      let digestStatus: 'valid' | 'invalid' | 'unverifiable';
      try {
        const result = verifyBundle(bundle);
        digestStatus = result.valid ? 'valid' : 'invalid';
      } catch {
        digestStatus = 'unverifiable';
      }

      // Count event types
      const eventTypes: Record<string, number> = {};
      for (const event of bundle.events) {
        const t: BundleEventType = event.type;
        eventTypes[t] = (eventTypes[t] ?? 0) + 1;
      }

      // Timeline
      const timestamps = bundle.events.map((e) => e.timestamp).sort();

      const summary: ShowSummary = {
        bundle_id: bundle.bundle_id,
        schema_version: bundle.schema_version,
        created_at: bundle.created_at,
        ...(bundle.run_id !== undefined && { run_id: bundle.run_id }),
        event_count: bundle.events.length,
        event_types: eventTypes,
        timeline: {
          first: timestamps[0],
          last: timestamps[timestamps.length - 1],
        },
        digest_status: digestStatus,
      };

      if (options.format === 'json') {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        printTextSummary(summary);
      }
    });
}

function printTextSummary(summary: ShowSummary): void {
  console.log(`Bundle:     ${summary.bundle_id}`);
  console.log(`Schema:     ${summary.schema_version}`);
  console.log(`Created:    ${summary.created_at}`);
  if (summary.run_id) {
    console.log(`Run ID:     ${summary.run_id}`);
  }
  console.log(`Events:     ${summary.event_count}`);
  console.log('');
  console.log('Event Types:');
  for (const [type, count] of Object.entries(summary.event_types)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log('');
  console.log('Timeline:');
  console.log(`  First:    ${summary.timeline.first ?? '(none)'}`);
  console.log(`  Last:     ${summary.timeline.last ?? '(none)'}`);
  console.log('');
  console.log(`Digest:     ${summary.digest_status}`);
}
