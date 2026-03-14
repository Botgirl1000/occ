# Modular TypeScript Refactoring — Complete

## What Was Refactored

OCC's `src/` codebase (58 TypeScript files, ~7,500 lines) was organized into a
formally enforced 5-layer module architecture. The existing directory structure
was already well-organized, so no files were moved between directories. The work
focused on:

1. **Defining and documenting** the implicit module boundaries that already existed
2. **Enforcing the dependency DAG** with an automated linter (`scripts/check-imports.mjs`)
3. **Eliminating cross-domain dependencies** by extracting shared XLSX cell utilities
4. **Adding integration tests** to verify cross-module composition
5. **Tightening TypeScript strictness** settings

## Final Module Structure

```
Layer 4:  cli                         — CLI orchestrator
Layer 3:  code, inspect-commands      — domain command modules
Layer 2:  output                      — formatting layer
Layer 1:  pipeline, content           — infrastructure
Layer 0:  shared                      — types and utilities
```

| Module | Layer | Files | Location |
|--------|-------|-------|----------|
| `shared` | 0 | 4 | `src/types.ts`, `src/utils.ts`, `src/@types/` |
| `pipeline` | 1 | 11 | `src/walker.ts`, `src/parsers/`, `src/stats.ts`, `src/scc.ts`, `src/progress.ts`, `src/cli-validation.ts` |
| `content` | 1 | 6 | `src/markdown/`, `src/structure/`, `src/inspect/` |
| `output` | 2 | 3 | `src/output/` |
| `code` | 3 | 8 | `src/code/` |
| `inspect-commands` | 3 | 26 | `src/doc/`, `src/sheet/`, `src/slide/`, `src/table/` |
| `cli` | 4 | 1 | `src/cli.ts` |

**Total: 59 files** (58 original + 1 new `inspect/xlsx-cells.ts`)

## Key Decisions

1. **D1: Keep existing directory structure** — no files moved between directories
2. **D2: Root-level files stay at root** — single files don't need subdirectories
3. **D3: Extract xlsx-cells** — `getCell`/`renderCell`/`isNonEmptyCell` moved from `sheet/inspect.ts` to `inspect/xlsx-cells.ts`, eliminating the `table→sheet` peer dependency
4. **D4-D7:** Kept `inspect/shared.ts`, `cli-validation.ts`, `output/tree.ts` StructureResult, and existing barrel files in place

## Metrics — Before vs After

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| TS files | 58 | 59 | +1 |
| Total lines | 7,526 | ~7,530 | +4 |
| Circular dependencies | 0 | 0 | 0 |
| Import DAG violations | N/A | 0 | New |
| `any` usage | 0 | 0 | 0 |
| Tests | 55 | 66 | +11 |
| Test pass rate | 100% | 100% | 0 |
| DAG linter | Missing | `check-imports.mjs` | New |
| `noImplicitReturns` | off | on | New |
| `noFallthroughCasesInSwitch` | off | on | New |

## What Was Created

- `scripts/check-imports.mjs` — import DAG enforcement linter
- `src/inspect/xlsx-cells.ts` — shared XLSX cell utilities (extracted from `sheet/inspect.ts`)
- `test/integration-modules.test.ts` — 11 cross-module integration tests
- `specs/_templates/new-feature.md` — template for future features
- `specs/*/design.md` — per-module design documentation (7 files)

## Remaining Technical Debt

1. **`noUncheckedIndexedAccess`** — not enabled; causes >20 errors in `code/parsers.ts` and `code/output.ts` due to regex match group indexing
2. **No table inspection tests** — `src/table/` has no dedicated test file
3. **~13 exported functions lack explicit return type annotations** — rely on inference (type-safe but not documented)
4. **Two files over 500 lines** — `code/parsers.ts` (537) and `sheet/inspect.ts` (507) are cohesive but large

## Phases

| Phase | Description | Duration |
|-------|-------------|----------|
| 0 | Discovery & Baseline | ~3.5 min |
| 1 | Define Target Architecture | ~11.5 min |
| 2 | Infrastructure & Safety Net | ~5 min |
| 3 | Extract Modules | ~6 min |
| 4 | Validate & Harden | ~4 min |
| 5 | Cleanup & Finalize | — |
