# Contributing to trustbundle

Thank you for your interest in contributing to trustbundle!

## Development Setup

```bash
git clone https://github.com/wharfe/trustbundle.git
cd trustbundle
npm install
```

## Commands

| Command | Description |
|---|---|
| `npm run build` | Compile TypeScript |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm test` | Run tests with vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with eslint |

## Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Run checks: `npm run typecheck && npm run lint && npm test`
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat(core): add new feature
   fix(cli): fix a bug
   docs: update documentation
   ```
6. Open a pull request

## Guidelines

- All code is TypeScript with strict mode enabled
- Tests are required for new features and bug fixes
- Code comments in English
- Do not add fields or features not specified in the design documents
- Keep changes focused — one concern per pull request

## Architecture

```
src/
  cli/        — CLI entry point & subcommands
  core/       — types, bundle engine, digest computation
  adapters/   — input source adapters (jsonl, agentbond)
  index.ts    — library re-exports
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
