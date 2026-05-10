import { formatCsv } from './csv.js';
import { formatJson } from './json.js';
import { formatKeenetic } from './keenetic.js';
import { formatMarkdown } from './markdown.js';
import { formatTable } from './table.js';
import { formatYaml } from './yaml.js';

export const format = {
  csv: formatCsv,
  json: formatJson,
  yaml: formatYaml,
  keenetic: formatKeenetic,
  md: formatMarkdown,
  table: formatTable,
};

export type FormatName = keyof typeof format;
