import path from 'node:path';

export function countWords(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

export function formatNumber(n) {
  if (n == null) return '';
  return n.toLocaleString('en-US');
}

export function getExtension(filePath) {
  return path.extname(filePath).toLowerCase().replace('.', '');
}

export const OFFICE_EXTENSIONS = ['docx', 'xlsx', 'pptx', 'pdf', 'odt', 'ods', 'odp'];

export const EXTENSION_TO_TYPE = {
  docx: 'Word',
  pdf: 'PDF',
  xlsx: 'Excel',
  pptx: 'PowerPoint',
  odt: 'ODT',
  ods: 'ODS',
  odp: 'ODP',
};
