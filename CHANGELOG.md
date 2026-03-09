# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-03-09

### Added

- Core type definitions: `BundleEvent`, `TrustBundle`, `VerifyResult`, `BundleAdapter`
- Bundle engine with canonical JSON digest computation (`sha256`)
- JSONL adapter for generic line-delimited JSON input
- agentbond adapter for `AuditRecord[]` JSON input
- CLI commands: `init`, `build`, `verify`, `show`
- Digest integrity verification with tamper detection
- CI pipeline (tsc + eslint + vitest + publint, Node 20/22)

[Unreleased]: https://github.com/wharfe/trustbundle/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/wharfe/trustbundle/releases/tag/v0.1.0
