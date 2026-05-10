import pc from 'picocolors';
import type { FormattableInput } from '../types/domain.js';
import { toRows } from './rows.js';

interface TableOptions {
  color?: boolean;
}

interface ColorAdapter {
  bold(s: string): string;
  dim(s: string): string;
  cyan(s: string): string;
}

const noColor: ColorAdapter = {
  bold: (s) => s,
  dim: (s) => s,
  cyan: (s) => s,
};

const W = { cidr: 18, asn: 10, name: 20, country: 2, count: 5, fqdns: 70 } as const;
const HEADERS = ['CIDR', 'ASN', 'Name', 'CC', 'Count', 'FQDNs'] as const;
const WIDTHS = [W.cidr, W.asn, W.name, W.country, W.count, W.fqdns] as const;

type Colorize = (s: string) => string;
const ID: Colorize = (s) => s;

function padLeft(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : ' '.repeat(w - s.length) + s;
}

function padRight(s: string, w: number): string {
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

function fitTrunc(s: string, w: number): string {
  if (s.length <= w) return padRight(s, w);
  return w >= 4 ? `${s.slice(0, w - 3)}...` : s.slice(0, w);
}

function fitNumLeft(n: number, w: number): string {
  const max = 10 ** w - 1;
  return padRight(String(n > max ? max : n), w);
}

function fitNumRight(n: number, w: number): string {
  const max = 10 ** w - 1;
  return padLeft(String(n > max ? max : n), w);
}

function border(left: string, mid: string, right: string): string {
  return left + WIDTHS.map((w) => '─'.repeat(w + 2)).join(mid) + right;
}

const TOP = border('┌', '┬', '┐');
const SEP = border('├', '┼', '┤');
const BOT = border('└', '┴', '┘');

function renderLine(cells: readonly string[], colors: readonly Colorize[]): string {
  const parts: string[] = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i] ?? '';
    const fn = colors[i] ?? ID;
    parts.push(` ${fn(cell)} `);
  }
  return `│${parts.join('│')}│`;
}

function renderRow(
  base: readonly [string, string, string, string, string],
  fqdns: readonly string[],
  colors: readonly [Colorize, Colorize, Colorize, Colorize, Colorize, Colorize],
): string {
  const lines: string[] = [];
  const fqdnLines = fqdns.length > 0 ? fqdns : [padRight('', W.fqdns)];
  for (let i = 0; i < fqdnLines.length; i++) {
    const fqdn = fqdnLines[i] ?? padRight('', W.fqdns);
    if (i === 0) {
      lines.push(renderLine([...base, fqdn], colors));
    } else {
      const blanks: readonly string[] = [
        padRight('', W.cidr),
        padRight('', W.asn),
        padRight('', W.name),
        padRight('', W.country),
        padRight('', W.count),
        fqdn,
      ];
      lines.push(renderLine(blanks, [ID, ID, ID, ID, ID, colors[5]]));
    }
  }
  return lines.join('\n');
}

export function formatTable(input: FormattableInput, opts: TableOptions = {}): string {
  const color = opts.color ?? true;
  const c: ColorAdapter = color ? pc : noColor;
  const rows = toRows(input);

  const out: string[] = [];

  if (input.kind === 'domain-report') {
    out.push(
      `${c.bold('Domain:')} ${input.domain}   ` +
        `${c.dim('providers:')} ${input.providers.join(', ')}   ` +
        `${c.dim('groups:')} ${input.groups.length}`,
    );
  } else {
    out.push(`${c.bold('FQDN:')} ${input.fqdn}   ${c.dim('IPs:')} ${input.ips.join(', ')}`);
  }

  out.push(TOP);
  out.push(
    renderLine(
      HEADERS.map((h, i) => padRight(h, WIDTHS[i] ?? 0)),
      [c.bold, c.bold, c.bold, c.bold, c.bold, c.bold],
    ),
  );
  out.push(SEP);

  const dataRows: string[] = [];
  for (const r of rows) {
    dataRows.push(
      renderRow(
        [
          fitTrunc(r.cidr, W.cidr),
          fitNumLeft(r.asn, W.asn),
          fitTrunc(r.asnName, W.name),
          fitTrunc(r.country, W.country),
          fitNumRight(r.fqdns.length, W.count),
        ],
        r.fqdns.map((f) => fitTrunc(f, W.fqdns)),
        [c.cyan, ID, ID, ID, ID, ID],
      ),
    );
  }

  if (input.kind === 'domain-report' && input.unresolved.length > 0) {
    const sorted = [...input.unresolved].sort();
    dataRows.push(
      renderRow(
        [
          fitTrunc('unresolved', W.cidr),
          fitTrunc('-', W.asn),
          fitTrunc('-', W.name),
          fitTrunc('-', W.country),
          fitNumRight(sorted.length, W.count),
        ],
        sorted.map((f) => fitTrunc(f, W.fqdns)),
        [c.dim, c.dim, c.dim, c.dim, c.dim, c.dim],
      ),
    );
  }

  if (dataRows.length > 0) out.push(dataRows.join(`\n${SEP}\n`));
  out.push(BOT);
  return `${out.join('\n')}\n`;
}
