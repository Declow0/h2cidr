import { prefixLenToMask } from '../ip/cidr.js';
import type { Ipv4 } from '../types/brand.js';
import { asIpv4 } from '../types/brand.js';
import type { FormattableInput } from '../types/domain.js';
import { toRows } from './rows.js';

interface KeeneticOptions {
  gateway?: Ipv4;
  annotate?: boolean;
  eol?: 'lf' | 'crlf';
}

const DEFAULT_GATEWAY = asIpv4('0.0.0.0');

export function formatKeenetic(input: FormattableInput, opts: KeeneticOptions = {}): string {
  const gateway = opts.gateway ?? DEFAULT_GATEWAY;
  const annotate = opts.annotate ?? false;
  const eol = (opts.eol ?? 'crlf') === 'crlf' ? '\r\n' : '\n';

  const rows = toRows(input);
  const lines: string[] = ['@echo off'];
  for (const r of rows) {
    const slash = r.cidr.indexOf('/');
    const ip = r.cidr.slice(0, slash);
    const prefix = Number(r.cidr.slice(slash + 1));
    const mask = prefixLenToMask(prefix);
    lines.push(`route add ${ip} mask ${mask} ${gateway}`);
    if (annotate) {
      const fqdns = r.fqdns.length === 0 ? '' : ` ${r.fqdns.join(',')}`;
      lines.push(`:: ASN${r.asn} ${r.asnName}${fqdns}`);
    }
  }
  return lines.join(eol) + eol;
}
