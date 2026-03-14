# code Extraction — Progress Tracker

## Status: DONE

No files needed to move. Module boundaries already in place.

## Migration Table

| What | From | To | Status |
|------|------|----|--------|
| — | — | — | No migrations needed |

## Post-Extraction Checklist

- [x] No new index.ts needed (D7)
- [x] No re-export shims needed (files stay in place)
- [x] All consumers already use correct import paths
- [x] tsc --noEmit passes
- [x] Unit tests pass
- [x] Import linter passes
- [x] No new circular deps
- [x] Full test suite passes

## Notes & Decisions

- Files stay at `src/code/` per D1.
- `parsers.ts` (537 lines) is the largest file — intra-module split deferred to future work.
- Layer 3 module depending on `shared`, `pipeline`, `output`.
