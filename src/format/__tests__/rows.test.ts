import { describe, expect, it } from 'vitest';
import { asAsNumber, asFqdn, asIpv4 } from '../../types/brand.js';
import type { DomainReport, FqdnLookup } from '../../types/domain.js';
import { toRows } from '../rows.js';

const stubMatch = {
  rangeStart: asIpv4('5.0.0.0'),
  rangeEnd: asIpv4('5.0.255.255'),
  cidrs: ['5.0.0.0/16' as never],
  asn: { number: asAsNumber(12345), name: 'EXAMPLE-AS', country: 'RU' },
};

describe('toRows', () => {
  it('produces one row per CIDR for FqdnLookup', () => {
    const input: FqdnLookup = {
      kind: 'lookup-result',
      fqdn: asFqdn('api.example.com'),
      ips: [asIpv4('5.0.0.10')],
      matches: [stubMatch],
      generatedAt: new Date(),
    };
    const rows = toRows(input);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      cidr: '5.0.0.0/16',
      asn: 12345,
      asnName: 'EXAMPLE-AS',
      country: 'RU',
      fqdns: ['api.example.com'],
    });
  });

  it('dedupes by CIDR for DomainReport', () => {
    const input: DomainReport = {
      kind: 'domain-report',
      domain: asFqdn('example.com'),
      providers: ['stub'],
      groups: [
        {
          match: stubMatch,
          fqdns: [asFqdn('api.example.com'), asFqdn('cdn.example.com')],
          ips: [asIpv4('5.0.0.10'), asIpv4('5.0.0.11')],
        },
      ],
      unresolved: [],
      errors: [],
      generatedAt: new Date(),
    };
    const rows = toRows(input);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.fqdns.length).toBe(2);
    expect(rows[0]?.ips.length).toBe(2);
  });

  it('handles range that decomposes to multiple CIDRs', () => {
    const wide = {
      ...stubMatch,
      rangeEnd: asIpv4('6.0.0.0'),
      cidrs: ['5.0.0.0/8' as never, '6.0.0.0/32' as never],
    };
    const input: FqdnLookup = {
      kind: 'lookup-result',
      fqdn: asFqdn('x.example.com'),
      ips: [asIpv4('5.0.0.10')],
      matches: [wide],
      generatedAt: new Date(),
    };
    const rows = toRows(input);
    expect(rows.map((r) => r.cidr)).toEqual(['5.0.0.0/8', '6.0.0.0/32']);
  });
});
