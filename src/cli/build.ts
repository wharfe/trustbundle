import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { Command } from 'commander';
import type { BundleEvent, TrustBundleConfig } from '../core/types.js';
import { buildBundle } from '../core/engine.js';
import { jsonlAdapter } from '../adapters/jsonl.js';
import { agentbondAdapter } from '../adapters/agentbond.js';

function detectAdapter(filePath: string): 'jsonl' | 'agentbond' | null {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.jsonl') return 'jsonl';
  if (ext === '.json') return 'agentbond';
  return null;
}

interface BuildOptions {
  source?: string;
  runId?: string;
  description?: string;
  out?: string;
}

export function registerBuild(program: Command): void {
  program
    .command('build')
    .description('Build a TrustBundle from input files')
    .argument('<files...>', 'Input files to bundle')
    .option('--source <source>', 'Override adapter for all files')
    .option('--run-id <id>', 'Attach a run ID to the bundle')
    .option('--description <str>', 'Attach a description to the bundle')
    .option('--out <path>', 'Override output path')
    .action(async (files: string[], options: BuildOptions) => {
      const allEvents: BundleEvent[] = [];

      for (const filePath of files) {
        let content: string;
        try {
          content = await readFile(filePath, 'utf8');
        } catch {
          console.error(`Error: cannot read file: ${filePath}`);
          process.exit(2);
        }

        const adapterName = options.source ?? detectAdapter(filePath);
        if (!adapterName) {
          console.error(
            `Error: cannot detect adapter for ${filePath}. Use --source to specify.`,
          );
          process.exit(2);
        }

        let events: BundleEvent[];
        try {
          if (adapterName === 'jsonl') {
            events = await jsonlAdapter.parse(content);
          } else if (adapterName === 'agentbond') {
            events = await agentbondAdapter.parse(content);
          } else {
            console.error(`Error: unknown adapter: ${adapterName}`);
            process.exit(2);
            return; // unreachable, for type narrowing
          }
        } catch (err) {
          console.error(
            `Error processing ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
          );
          process.exit(2);
          return;
        }

        allEvents.push(...events);
      }

      if (allEvents.length === 0) {
        console.error('Error: no events produced from input files');
        process.exit(1);
      }

      const bundle = buildBundle(allEvents, {
        runId: options.runId,
        description: options.description,
      });

      // Determine output path
      let outputPath: string;
      if (options.out) {
        outputPath = options.out;
      } else {
        // Try to read config
        const configPath = join(process.cwd(), '.trustbundle', 'config.json');
        let outputDir: string;
        try {
          await access(configPath);
          const configRaw = await readFile(configPath, 'utf8');
          const config = JSON.parse(configRaw) as TrustBundleConfig;
          outputDir = join(process.cwd(), config.output_dir);
        } catch {
          // No config — output to current directory
          outputDir = '.';
        }
        await mkdir(outputDir, { recursive: true });
        outputPath = join(outputDir, `${bundle.bundle_id}.json`);
      }

      await writeFile(outputPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
      console.log(outputPath);
    });
}
