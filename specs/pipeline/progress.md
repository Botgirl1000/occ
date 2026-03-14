# pipeline Extraction — Progress Tracker

## Status: DONE

No files needed to move. Module boundaries already in place.

## Migration Table

| What | From | To | Status |
|------|------|----|--------|
| — | — | — | No migrations needed |

## Post-Extraction Checklist

- [x] No index.ts needed (parsers/index.ts already exists)
- [x] No re-export shims needed (files stay in place)
- [x] All consumers already use correct import paths
- [x] tsc --noEmit passes
- [x] Unit tests pass
- [x] Import linter passes
- [x] No new circular deps
- [x] Full test suite passes

## Notes & Decisions

- Files stay at root (`walker.ts`, `stats.ts`, `scc.ts`, `progress.ts`, `cli-validation.ts`) and `parsers/` per D1/D2.
- Layer 1 module depending only on `shared`.
