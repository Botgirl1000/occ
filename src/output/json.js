import { METRIC_FIELDS, hasKey } from '../utils.js';

export function formatJson(stats, sccData = null) {
  const { columns } = stats;

  const mapRow = (r) => {
    const entry = {
      type: r.fileType,
      ...(r.fileName ? { name: r.fileName } : {}),
      ...(r.filePath ? { path: r.filePath } : {}),
      count: r.files,
    };
    for (const f of METRIC_FIELDS) {
      if (r[hasKey(f)]) entry[f] = r[f] || 0;
    }
    entry.size = r.size;
    return entry;
  };

  const mapTotals = (t) => {
    const entry = { files: t.files };
    for (const f of METRIC_FIELDS) {
      if (columns[hasKey(f)]) entry[f] = t[f];
    }
    entry.size = t.size;
    return entry;
  };

  const output = {
    documents: {
      files: stats.rows.map(mapRow),
      totals: mapTotals(stats.totals),
    },
  };

  if (sccData && sccData.length > 0) {
    output.code = sccData;
  }

  return JSON.stringify(output, null, 2);
}
