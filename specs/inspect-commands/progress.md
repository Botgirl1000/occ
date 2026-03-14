# inspect-commands Extraction — Progress Tracker

## Status: DONE

Cross-domain dependency resolved: `table/inspect-xlsx.ts` no longer imports
from `sheet/inspect.ts`. It now imports from `inspect/xlsx-cells.ts` (Layer 1).

## Migration Table

| What | From | To | Status |
|------|------|----|--------|
| `table/inspect-xlsx.ts` import of `getCell`, `renderCell`, `isNonEmptyCell` | `sheet/inspect.ts` | `inspect/xlsx-cells.ts` | Done |

## Post-Extraction Checklist

- [x] No new index.ts needed (D7)
- [x] Re-export shim in `sheet/inspect.ts` for deprecated exports
- [x] `table/inspect-xlsx.ts` consumer updated to `inspect/xlsx-cells.ts`
- [x] `check-imports.mjs`: removed `'sheet'` from table's allowed deps
- [x] tsc --noEmit passes
- [x] Unit tests pass (55/55)
- [x] Import linter passes (57 files, 0 violations)
- [x] No new circular deps
- [x] Full test suite passes

## Notes & Decisions

- `sheet/inspect.ts` (528 lines) — intra-module split deferred to future work.
- `table/` has no dedicated tests — adding tests recommended before future refactoring.
- All 4 sub-domains (doc, sheet, slide, table) are Layer 3 modules.
