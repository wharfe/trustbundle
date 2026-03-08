# trustbundle

Pack AI agent execution traces into verifiable bundles for audit, compliance, and incident investigation.

## Why

AI agents make autonomous decisions, but when something goes wrong, you need to **explain** what happened — not just observe or control it.

trustbundle takes agent execution traces from any source and seals them into a single, integrity-protected bundle that you can hand to auditors, attach to incident reports, or archive for compliance.

## Quick Start

```bash
npm install -g trustbundle

# Initialize a project
trustbundle init

# Build a bundle from trace files
trustbundle build traces.jsonl

# Verify bundle integrity
trustbundle verify .trustbundle/bundles/<bundle_id>.json

# Show bundle summary
trustbundle show .trustbundle/bundles/<bundle_id>.json
```

## Design Principles

1. **Independence** — Works standalone without agentbond or agent-trust-telemetry. Accepts any JSONL as input.
2. **Single Responsibility** — Build, verify, and show bundles. Nothing else.
3. **Machine Verifiability** — A bundle is a single self-contained file, verifiable by program. Human-readable output is the `show` command's job.
4. **Progressive Trust** — MVP uses digest (tamper detection) only. Signatures come in the next phase.
5. **Adapter Design** — Input sources are abstracted via adapters, so adding new sources never touches core logic.

## Commands

| Command | Description |
|---|---|
| `trustbundle init` | Initialize configuration in the current directory |
| `trustbundle build <file...>` | Build a TrustBundle from input files |
| `trustbundle verify <bundle.json>` | Verify bundle integrity via digest re-computation |
| `trustbundle show <bundle.json>` | Display a human-readable bundle summary |

## Adapters

| Adapter | Input Format | Status |
|---|---|---|
| `jsonl` | Generic JSONL (one JSON object per line) | MVP |
| `agentbond` | agentbond `AuditRecord[]` (JSON array) | MVP |
| `otel` | OpenTelemetry spans | Planned |

## Related Projects

| Project | Role |
|---|---|
| [agentbond](https://github.com/wharfe/agentbond) | Authorization & audit layer — bundle event source |
| agent-trust-telemetry | Runtime contamination detection — bundle event source |

Together these form the **agent trust stack**: before (authorization) → during (telemetry) → after (trustbundle).

## Status

**v0.1.0 — MVP** (digest-only integrity verification)

- Signature support planned for v0.2
- KMS integration planned for v1.0

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
