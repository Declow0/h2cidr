import { describe, expect, it } from 'vitest';
import { asAsNumber, asFqdn, asIpv4 } from '../../types/brand.js';
import type { DomainReport, FqdnLookup } from '../../types/domain.js';
import { formatMarkdown } from '../markdown.js';

const lookup: FqdnLookup = {
  kind: 'lookup-result',
  fqdn: asFqdn('api.example.com'),
  ips: [asIpv4('5.0.0.10')],
  matches: [
    {
      rangeStart: asIpv4('5.0.0.0'),
      rangeEnd: asIpv4('5.0.255.255'),
      cidrs: ['5.0.0.0/16' as never],
      asn: { number: asAsNumber(12345), name: 'EXAMPLE-AS', country: 'RU' },
    },
  ],
  generatedAt: new Date(),
};

describe('formatMarkdown', () => {
  it('renders a GFM table for FqdnLookup', () => {
    const out = formatMarkdown(lookup);
    expect(out).toContain('**FQDN:** api.example.com');
    expect(out).toContain('| CIDR | ASN | Name | CC | Count | FQDNs |');
    expect(out).toContain('| --- | --- | --- | --- | --- | --- |');
    expect(out).toContain('| 5.0.0.0/16 | 12345 | EXAMPLE-AS | RU | 1 | api.example.com |');
  });

  it('joins multiple FQDNs in a cell with <br>', () => {
    const report: DomainReport = {
      kind: 'domain-report',
      domain: asFqdn('example.com'),
      providers: ['stub'],
      groups: [
        {
          match: {
            rangeStart: asIpv4('5.0.0.0'),
            rangeEnd: asIpv4('5.0.255.255'),
            cidrs: ['5.0.0.0/16' as never],
            asn: { number: asAsNumber(12345), name: 'EXAMPLE-AS', country: 'RU' },
          },
          fqdns: [asFqdn('a.example.com'), asFqdn('b.example.com')],
          ips: [asIpv4('5.0.0.10')],
        },
      ],
      unresolved: [asFqdn('dead.example.com')],
      errors: [],
      generatedAt: new Date(),
    };
    const out = formatMarkdown(report);
    expect(out).toContain('a.example.com<br>b.example.com');
    expect(out).toContain('| _unresolved_ | - | - | - | 1 | dead.example.com |');
  });
});
