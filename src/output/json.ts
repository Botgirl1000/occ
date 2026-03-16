import { METRIC_FIELDS, hasKey } from '../utils.js';
import { formatStructureJson } from './tree.js';
import type { AggregateResult, StatsRow } from '../stats.js';
import type { SccLanguage } from '../scc.js';
import type { StructureResult } from './tree.js';

export function formatJson(
  stats: AggregateResult,
  sccData: SccLanguage[] | null = null,
  structureResults?: StructureResult[],
): string {
  const { columns } = stats;

  const mapRow = (r: StatsRow) => {
    const entry: Record<string, unknown> = {
      type: r.fileType,
      ...(r.fileName ? { name: r.fileName } : {}),
      ...(r.filePath ? { path: r.filePath } : {}),
      count: r.files,
    };
    for (const f of METRIC_FIELDS) {
      if (r[hasKey(f)]) entry[f] = r[f] || 0;
    }
    entry.size = r.size;
    if (stats.showConfidence && r.confidence) {
      const conf: Record<string, string> = {};
      for (const f of METRIC_FIELDS) {
        if (r[hasKey(f)] && r.confidence[f]) conf[f] = r.confidence[f];
      }
      if (Object.keys(conf).length > 0) entry.confidence = conf;
    }
    return entry;
  };

  const mapTotals = (t: StatsRow) => {
    const entry: Record<string, unknown> = { files: t.files };
    for (const f of METRIC_FIELDS) {
      if (columns[hasKey(f)]) entry[f] = t[f];
    }
    entry.size = t.size;
    return entry;
  };

  const output: Record<string, unknown> = {
    documents: {
      files: stats.rows.map(mapRow),
      totals: mapTotals(stats.totals),
    },
  };

  if (sccData && sccData.length > 0) {
    output.code = sccData;
  }

  if (structureResults && structureResults.length > 0) {
    output.structures = formatStructureJson(structureResults);
  }

  return JSON.stringify(output, null, 2);
}
