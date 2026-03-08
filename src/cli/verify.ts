import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';
import type { TrustBundle } from '../core/types.js';
import { verifyBundle } from '../core/engine.js';

interface VerifyOptions {
  quiet?: boolean;
}

export function registerVerify(program: Command): void {
  program
    .command('verify')
    .description('Verify bundle integrity via digest re-computation')
    .argument('<bundle>', 'Path to bundle JSON file')
    .option('--quiet', 'Output only valid/invalid (for CI)')
    .action(async (bundlePath: string, options: VerifyOptions) => {
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
      if (!bundle.bundle_id || !bundle.events || !bundle.digest) {
        console.error(`Error: invalid bundle schema in ${bundlePath}`);
        process.exit(2);
        return;
      }

      const result = verifyBundle(bundle);

      if (options.quiet) {
        console.log(result.valid ? 'valid' : 'invalid');
      } else {
        console.log(JSON.stringify(result, null, 2));
      }

      if (!result.valid) {
        process.exit(1);
      }
    });
}
