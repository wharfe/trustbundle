import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TrustBundle, VerifyResult } from '../../core/types.js';

const execFileAsync = promisify(execFile);
const CLI = join(import.meta.dirname, '../../../dist/cli/index.js');

let testDir: string;

async function run(
  args: string[],
  options?: { cwd?: string },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const cwd = options?.cwd ?? testDir;
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI, ...args], {
      cwd,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout: string; stderr: string; code: number };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.code };
  }
}

beforeEach(async () => {
  testDir = join(tmpdir(), `trustbundle-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

// --- init ---

describe('trustbundle init', () => {
  it('creates config and bundles directory', async () => {
    const { stdout, exitCode } = await run(['init']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Initialized');

    const config = JSON.parse(
      await readFile(join(testDir, '.trustbundle', 'config.json'), 'utf8'),
    );
    expect(config.version).toBe('0.1');
    expect(config.output_dir).toBe('.trustbundle/bundles');
  });

  it('fails if already initialized', async () => {
    await run(['init']);
    const { stderr, exitCode } = await run(['init']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('Already initialized');
  });
});

// --- build ---

describe('trustbundle build', () => {
  const jsonlContent = [
    '{"timestamp":"2026-03-01T00:00:00Z","action":"read"}',
    '{"timestamp":"2026-03-01T00:01:00Z","action":"write"}',
  ].join('\n');

  it('builds a bundle from JSONL and outputs to .trustbundle/bundles/', async () => {
    await run(['init']);
    const inputFile = join(testDir, 'traces.jsonl');
    await writeFile(inputFile, jsonlContent);

    const { stdout, exitCode } = await run(['build', 'traces.jsonl']);
    expect(exitCode).toBe(0);

    const bundlePath = stdout.trim();
    expect(bundlePath).toContain('.trustbundle/bundles/');
    expect(bundlePath).toMatch(/\.json$/);

    const bundle = JSON.parse(await readFile(bundlePath, 'utf8')) as TrustBundle;
    expect(bundle.schema_version).toBe('0.1');
    expect(bundle.event_count).toBe(2);
    expect(bundle.events).toHaveLength(2);
    expect(bundle.digest.value).toMatch(/^sha256:/);
  });

  it('builds with --run-id and --description', async () => {
    await run(['init']);
    const inputFile = join(testDir, 'traces.jsonl');
    await writeFile(inputFile, jsonlContent);

    const { stdout } = await run([
      'build', 'traces.jsonl',
      '--run-id', 'run-42',
      '--description', 'test run',
    ]);
    const bundle = JSON.parse(
      await readFile(stdout.trim(), 'utf8'),
    ) as TrustBundle;
    expect(bundle.run_id).toBe('run-42');
    expect(bundle.description).toBe('test run');
  });

  it('builds with --out to custom path', async () => {
    const inputFile = join(testDir, 'traces.jsonl');
    await writeFile(inputFile, jsonlContent);
    const outPath = join(testDir, 'custom.json');

    const { exitCode } = await run(['build', 'traces.jsonl', '--out', outPath]);
    expect(exitCode).toBe(0);

    const bundle = JSON.parse(await readFile(outPath, 'utf8')) as TrustBundle;
    expect(bundle.event_count).toBe(2);
  });

  it('builds from agentbond JSON', async () => {
    await run(['init']);
    const records = [
      { id: 'rec-1', timestamp: '2026-03-01T00:00:00Z', layer: 'authorization', action: 'allow' },
      { id: 'rec-2', timestamp: '2026-03-01T00:01:00Z', layer: 'budget', amount: 100 },
    ];
    const inputFile = join(testDir, 'audit.json');
    await writeFile(inputFile, JSON.stringify(records));

    const { stdout, exitCode } = await run(['build', 'audit.json']);
    expect(exitCode).toBe(0);

    const bundle = JSON.parse(
      await readFile(stdout.trim(), 'utf8'),
    ) as TrustBundle;
    expect(bundle.event_count).toBe(2);
    expect(bundle.events[0]!.source).toBe('agentbond');
    expect(bundle.events[0]!.type).toBe('authorization_decision');
    expect(bundle.events[1]!.type).toBe('budget_consumed');
  });

  it('builds with --source override', async () => {
    await run(['init']);
    // Use .txt extension (unknown) with --source jsonl
    const inputFile = join(testDir, 'data.txt');
    await writeFile(inputFile, '{"timestamp":"2026-03-01T00:00:00Z","x":1}');

    const { stdout, exitCode } = await run([
      'build', 'data.txt', '--source', 'jsonl',
    ]);
    expect(exitCode).toBe(0);

    const bundle = JSON.parse(
      await readFile(stdout.trim(), 'utf8'),
    ) as TrustBundle;
    expect(bundle.event_count).toBe(1);
  });

  it('fails for unknown file extension without --source', async () => {
    const inputFile = join(testDir, 'data.txt');
    await writeFile(inputFile, '{"timestamp":"2026-03-01T00:00:00Z"}');

    const { stderr, exitCode } = await run(['build', 'data.txt']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('cannot detect adapter');
  });

  it('fails for non-existent file', async () => {
    const { stderr, exitCode } = await run(['build', 'missing.jsonl']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('cannot read file');
  });

  it('merges multiple input files sorted by timestamp', async () => {
    await run(['init']);
    const file1 = join(testDir, 'a.jsonl');
    const file2 = join(testDir, 'b.jsonl');
    await writeFile(file1, '{"timestamp":"2026-03-02T00:00:00Z","from":"a"}');
    await writeFile(file2, '{"timestamp":"2026-03-01T00:00:00Z","from":"b"}');

    const { stdout } = await run(['build', 'a.jsonl', 'b.jsonl']);
    const bundle = JSON.parse(
      await readFile(stdout.trim(), 'utf8'),
    ) as TrustBundle;
    expect(bundle.event_count).toBe(2);
    // b should come first (earlier timestamp)
    expect((bundle.events[0]!.payload as { from: string }).from).toBe('b');
    expect((bundle.events[1]!.payload as { from: string }).from).toBe('a');
  });
});

// --- verify ---

describe('trustbundle verify', () => {
  async function buildTestBundle(): Promise<string> {
    await run(['init']);
    const inputFile = join(testDir, 'traces.jsonl');
    await writeFile(
      inputFile,
      '{"timestamp":"2026-03-01T00:00:00Z","action":"test"}',
    );
    const { stdout } = await run(['build', 'traces.jsonl']);
    return stdout.trim();
  }

  it('returns valid for an unmodified bundle', async () => {
    const bundlePath = await buildTestBundle();
    const { stdout, exitCode } = await run(['verify', bundlePath]);
    expect(exitCode).toBe(0);
    const result = JSON.parse(stdout) as VerifyResult;
    expect(result.valid).toBe(true);
  });

  it('returns valid with --quiet', async () => {
    const bundlePath = await buildTestBundle();
    const { stdout, exitCode } = await run(['verify', bundlePath, '--quiet']);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('valid');
  });

  it('detects tampering and exits with code 1', async () => {
    const bundlePath = await buildTestBundle();
    const bundle = JSON.parse(await readFile(bundlePath, 'utf8')) as TrustBundle;
    bundle.events[0]!.payload = { action: 'tampered' };
    await writeFile(bundlePath, JSON.stringify(bundle, null, 2));

    const { stdout, exitCode } = await run(['verify', bundlePath]);
    expect(exitCode).toBe(1);
    const result = JSON.parse(stdout) as VerifyResult;
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('DIGEST_MISMATCH');
  });

  it('--quiet shows invalid for tampered bundle', async () => {
    const bundlePath = await buildTestBundle();
    const bundle = JSON.parse(await readFile(bundlePath, 'utf8')) as TrustBundle;
    bundle.events[0]!.payload = { action: 'tampered' };
    await writeFile(bundlePath, JSON.stringify(bundle, null, 2));

    const { stdout, exitCode } = await run(['verify', bundlePath, '--quiet']);
    expect(exitCode).toBe(1);
    expect(stdout.trim()).toBe('invalid');
  });

  it('exits with code 2 for non-existent file', async () => {
    const { exitCode, stderr } = await run(['verify', 'missing.json']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('cannot read file');
  });

  it('exits with code 2 for invalid JSON', async () => {
    const badFile = join(testDir, 'bad.json');
    await writeFile(badFile, 'not json');
    const { exitCode, stderr } = await run(['verify', badFile]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('invalid JSON');
  });
});

// --- show ---

describe('trustbundle show', () => {
  async function buildTestBundle(): Promise<string> {
    await run(['init']);
    const inputFile = join(testDir, 'traces.jsonl');
    await writeFile(
      inputFile,
      [
        '{"timestamp":"2026-03-01T00:00:00Z","action":"read"}',
        '{"timestamp":"2026-03-01T00:01:00Z","action":"write"}',
      ].join('\n'),
    );
    const { stdout } = await run([
      'build', 'traces.jsonl', '--run-id', 'run-1',
    ]);
    return stdout.trim();
  }

  it('shows text summary by default', async () => {
    const bundlePath = await buildTestBundle();
    const { stdout, exitCode } = await run(['show', bundlePath]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Bundle:');
    expect(stdout).toContain('Events:     2');
    expect(stdout).toContain('Run ID:     run-1');
    expect(stdout).toContain('audit_record: 2');
    expect(stdout).toContain('Digest:     valid');
  });

  it('shows JSON with --format json', async () => {
    const bundlePath = await buildTestBundle();
    const { stdout, exitCode } = await run([
      'show', bundlePath, '--format', 'json',
    ]);
    expect(exitCode).toBe(0);
    const summary = JSON.parse(stdout);
    expect(summary.event_count).toBe(2);
    expect(summary.run_id).toBe('run-1');
    expect(summary.digest_status).toBe('valid');
    expect(summary.event_types).toEqual({ audit_record: 2 });
  });

  it('shows invalid digest for tampered bundle without crashing', async () => {
    const bundlePath = await buildTestBundle();
    const bundle = JSON.parse(await readFile(bundlePath, 'utf8')) as TrustBundle;
    bundle.events[0]!.payload = { action: 'tampered' };
    await writeFile(bundlePath, JSON.stringify(bundle, null, 2));

    const { stdout, exitCode } = await run(['show', bundlePath]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Digest:     invalid');
  });

  it('exits with code 2 for invalid schema', async () => {
    const badFile = join(testDir, 'bad.json');
    await writeFile(badFile, JSON.stringify({ not: 'a bundle' }));
    const { exitCode, stderr } = await run(['show', badFile]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('invalid bundle schema');
  });

  it('exits with code 2 for non-existent file', async () => {
    const { exitCode, stderr } = await run(['show', 'missing.json']);
    expect(exitCode).toBe(2);
    expect(stderr).toContain('cannot read file');
  });
});
