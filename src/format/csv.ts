import type { FormattableInput } from '../types/domain.js';
import { toRows } from './rows.js';

interface CsvOptions {
  header?: boolean;
}

const COLUMNS = [
  'cidr',
  'range_start',
  'range_end',
  'asn',
  'asn_name',
  'country',
  'fqdns',
  'ips',
] as const;

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatCsv(input: FormattableInput, opts: CsvOptions = {}): string {
  const header = opts.header ?? true;
  const rows = toRows(input);
  const lines: string[] = [];
  if (header) lines.push(COLUMNS.join(','));
  for (const r of rows) {
    lines.push(
      [
        r.cidr,
        r.rangeStart,
        r.rangeEnd,
        String(r.asn),
        r.asnName,
        r.country,
        r.fqdns.join(';'),
        r.ips.join(';'),
      ]
        .map(escapeCsvValue)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
