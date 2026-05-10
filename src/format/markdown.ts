import type { FormattableInput } from '../types/domain.js';
import { toRows } from './rows.js';

const HEADERS = ['CIDR', 'ASN', 'Name', 'CC', 'Count', 'FQDNs'] as const;

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|');
}

function joinFqdns(fqdns: readonly string[]): string {
  return fqdns.map(escapeCell).join('<br>');
}

export function formatMarkdown(input: FormattableInput): string {
  const rows = toRows(input);
  const lines: string[] = [];

  if (input.kind === 'domain-report') {
    lines.push(`**Domain:** ${input.domain}`);
    lines.push(
      `**Providers:** ${input.providers.length > 0 ? input.providers.join(', ') : '_none_'}`,
    );
    lines.push(`**Groups:** ${input.groups.length}`);
  } else {
    lines.push(`**FQDN:** ${input.fqdn}`);
    lines.push(`**IPs:** ${input.ips.join(', ')}`);
  }
  lines.push('');

  lines.push(`| ${HEADERS.join(' | ')} |`);
  lines.push(`| ${HEADERS.map(() => '---').join(' | ')} |`);

  for (const r of rows) {
    lines.push(
      `| ${escapeCell(r.cidr)} | ${r.asn} | ${escapeCell(r.asnName)} | ${escapeCell(r.country)} | ${r.fqdns.length} | ${joinFqdns(r.fqdns)} |`,
    );
  }

  if (input.kind === 'domain-report' && input.unresolved.length > 0) {
    const sorted = [...input.unresolved].sort();
    lines.push(`| _unresolved_ | - | - | - | ${sorted.length} | ${joinFqdns(sorted)} |`);
  }

  return `${lines.join('\n')}\n`;
}
