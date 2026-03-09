# Contributing

Thank you for your interest in contributing to OCC! This page mirrors the [CONTRIBUTING.md](https://github.com/cesarandreslopez/occ/blob/main/CONTRIBUTING.md) in the repository.

## Getting Started

### Prerequisites

- Node.js 18+

### Development Setup

```bash
git clone https://github.com/cesarandreslopez/occ.git
cd occ
npm install
npm run build
```

### Verify Setup

```bash
node test/create-fixtures.js
node dist/bin/occ.js test/fixtures/
```

## Available Commands

```bash
npm run build                    # Compile TypeScript → dist/
npm run dev                      # Run via tsx (no build needed)
npm start                        # Run compiled output (node dist/bin/occ.js)
npm install                      # Install deps + auto-download scc binary
npm link                         # Make `occ` available globally

# Generate test fixtures
node test/create-fixtures.js

# Verify document scanning
node dist/bin/occ.js test/fixtures/
node dist/bin/occ.js --format json test/fixtures/
node dist/bin/occ.js --ci test/fixtures/
node dist/bin/occ.js --by-file test/fixtures/
node dist/bin/occ.js --structure test/fixtures/
```

## Code Style

- TypeScript with strict mode — all source under `src/` and `bin/` as `.ts`
- ES modules (`"type": "module"`) throughout
- `npm run build` compiles to `dist/`; `npx tsx` for dev without building
- No test runner or linter configured yet — contributions to add these are welcome
- [Conventional Commits](https://www.conventionalcommits.org/) for commit messages

## Making Changes

1. Create a feature branch from `main`
2. Make your changes with clear commits
3. Ensure `npm run build && node dist/bin/occ.js test/fixtures/` runs successfully
4. Update documentation if needed
5. Submit a PR with a clear description

### Branch Naming

- `feature/description` — new features
- `fix/description` — bug fixes
- `docs/description` — documentation changes
- `refactor/description` — code refactoring

## Areas for Contribution

- Test framework setup and test coverage
- New output formats (CSV, HTML)
- Additional document format support
- Performance improvements for large directories
- Documentation and developer experience
- Bug fixes

Look for issues labeled `good first issue` for newcomers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
