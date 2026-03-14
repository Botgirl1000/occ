# content Extraction — Progress Tracker

## Status: DONE

D3 extraction completed: xlsx cell utilities moved to `inspect/xlsx-cells.ts`.

## Migration Table

| What | From | To | Status |
|------|------|----|--------|
| `getCell`, `renderCell`, `isNonEmptyCell` | `sheet/inspect.ts` | `inspect/xlsx-cells.ts` | Done |

## Post-Extraction Checklist

- [x] `inspect/xlsx-cells.ts` created with 3 extracted functions
- [x] No new index.ts needed (D7)
- [x] Re-export shim in `sheet/inspect.ts` (deprecated)
- [x] Consumer `table/inspect-xlsx.ts` updated to new import path
- [x] tsc --noEmit passes
- [x] Unit tests pass (55/55)
- [x] Import linter passes (57 files, 0 violations)
- [x] No new circular deps
- [x] Full test suite passes

## Notes & Decisions

- This was the only cross-domain dependency in the codebase (D3).
- `check-imports.mjs` updated: removed `'sheet'` from table's allowed deps.
- The deprecated re-export in `sheet/inspect.ts` ensures backwards compatibility.
