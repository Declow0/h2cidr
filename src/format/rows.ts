import type { AsNumber, Cidr, Fqdn, Ipv4 } from '../types/brand.js';
import type { FormattableInput, RangeMatch } from '../types/domain.js';

interface CidrRow {
  readonly cidr: Cidr;
  readonly rangeStart: Ipv4;
  readonly rangeEnd: Ipv4;
  readonly asn: AsNumber;
  readonly asnName: string;
  readonly country: string;
  readonly fqdns: readonly Fqdn[];
  readonly ips: readonly Ipv4[];
}

interface Group {
  match: RangeMatch;
  fqdns: readonly Fqdn[];
  ips: readonly Ipv4[];
}

export function toRows(input: FormattableInput): CidrRow[] {
  const groups: readonly Group[] =
    input.kind === 'lookup-result'
      ? input.matches.map((m) => ({ match: m, fqdns: [input.fqdn], ips: input.ips }))
      : input.groups;

  const acc = new Map<Cidr, { match: RangeMatch; fqdns: Set<Fqdn>; ips: Set<Ipv4> }>();
  for (const g of groups) {
    for (const cidr of g.match.cidrs) {
      let e = acc.get(cidr);
      if (!e) {
        e = { match: g.match, fqdns: new Set(), ips: new Set() };
        acc.set(cidr, e);
      }
      for (const f of g.fqdns) e.fqdns.add(f);
      for (const ip of g.ips) e.ips.add(ip);
    }
  }

  return [...acc].map(([cidr, e]) => ({
    cidr,
    rangeStart: e.match.rangeStart,
    rangeEnd: e.match.rangeEnd,
    asn: e.match.asn.number,
    asnName: e.match.asn.name,
    country: e.match.asn.country,
    fqdns: [...e.fqdns].sort(),
    ips: [...e.ips].sort(),
  }));
}
