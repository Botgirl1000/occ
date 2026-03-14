# output Extraction — Progress Tracker

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

- Files stay at `src/output/` per D1.
- `StructureResult` stays in `output/tree.ts` per D6.
- Layer 2 module depending on `shared`, `pipeline`, `content`.
