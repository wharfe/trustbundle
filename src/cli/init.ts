import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from 'commander';
import type { TrustBundleConfig } from '../core/types.js';

const CONFIG_DIR = '.trustbundle';
const CONFIG_FILE = 'config.json';
const BUNDLES_DIR = 'bundles';

export function registerInit(program: Command): void {
  program
    .command('init')
    .description('Initialize trustbundle configuration in the current directory')
    .action(async () => {
      const configDir = join(process.cwd(), CONFIG_DIR);
      const configPath = join(configDir, CONFIG_FILE);
      const bundlesDir = join(configDir, BUNDLES_DIR);

      // Check if already initialized
      try {
        await access(configPath);
        console.error(`Already initialized: ${configPath} exists`);
        process.exit(1);
      } catch {
        // Expected — config does not exist yet
      }

      const config: TrustBundleConfig = {
        version: '0.1',
        output_dir: `.${join('/', CONFIG_DIR, BUNDLES_DIR)}`.slice(1), // ".trustbundle/bundles"
      };

      await mkdir(bundlesDir, { recursive: true });
      await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

      console.log(`Initialized trustbundle in ${configDir}`);
      console.log(`  config: ${configPath}`);
      console.log(`  bundles: ${bundlesDir}`);
    });
}
