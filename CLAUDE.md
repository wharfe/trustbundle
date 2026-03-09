# trustbundle

AI agent execution traces → signed, verifiable bundles for audit & compliance.

## Suite Position

This repository is **Layer 3 — After** in the [Agent Trust Suite](https://github.com/wharfe/agent-trust-suite).

- **Does:** Package agent execution traces into tamper-evident bundles with digest-based integrity verification. Supports multiple input adapters (JSONL, agentbond audit records).
- **Does not:** Cryptographic signing or key management (planned for future releases).
- **Install:** `npm install -g trustbundle` (v0.1.0, published to npm)
- **Input:** JSONL trace files or agentbond audit record JSON
- **Output:** Trust bundle JSON with SHA-256 integrity digests
- **Suite navigation:** See [AGENTS.md](https://github.com/wharfe/agent-trust-suite/blob/main/AGENTS.md) for full component map.

Single-package TypeScript CLI (not a monorepo).

## Tech Stack

- TypeScript 5.x (strict mode)
- Node.js >= 20, ESM (`"type": "module"`)
- Test: vitest
- Lint: eslint
- CLI framework: commander

## Commands

- `npm run build` — compile TypeScript
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — run all tests (`vitest run`)
- `npm run test:watch` — watch mode
- `npm run lint` — eslint

## Architecture

```
src/
  cli/        — CLI entry point & subcommands (init, build, verify, show)
  core/       — types, bundle engine, digest computation
  adapters/   — input source adapters (jsonl, agentbond; otel planned)
  index.ts    — library re-exports
```

Core concepts: `BundleEvent` (normalized event) and `TrustBundle` (bundle container).

## Implementation Rules

- Type-only files must not contain implementation logic
- Do NOT add fields not specified in the HANDOFF
- Do NOT create staging directories, add command, or state management
- `canonicalize` function lives in `src/core/engine.ts` — used by both build and verify
- Ask before implementing anything unclear
- All exposed docs, comments, and code are in English
- Communication with the user is in Japanese

## Key Specifications

- Digest covers `events` field only (not metadata like created_at, description)
- Canonical JSON: recursive key sort (Unicode code point order), no whitespace, drop undefined
- Digest format: `"sha256:<lowercase_hex>"`
- `event_count` must equal `events.length` (redundant verification field)

## Git Conventions

- Conventional Commits: `feat(core):`, `fix(cli):`, `docs:`, `chore:`
- CHANGELOG.md: Keep a Changelog format, Unreleased section at top

## Reference Documents

- `docs/trustbundle-HANDOFF.md` — Architecture & full specification (must-read)
- `docs/oss-dev-guidelines.md` — OSS development conventions
