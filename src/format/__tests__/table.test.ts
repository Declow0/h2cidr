import { describe, expect, it } from 'vitest';
import { asAsNumber, asFqdn, asIpv4 } from '../../types/brand.js';
import type { DomainReport, FqdnLookup } from '../../types/domain.js';
import { formatTable } from '../table.js';

const sample: FqdnLookup = {
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

describe('formatTable', () => {
  it('renders rows with headers', () => {
    const out = formatTable(sample, { color: false });
    expect(out).toContain('CIDR');
    expect(out).toContain('5.0.0.0/16');
    expect(out).toContain('EXAMPLE-AS');
  });

  it('appends unresolved row for domain reports with unresolved FQDNs', () => {
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
          fqdns: [asFqdn('api.example.com')],
          ips: [asIpv4('5.0.0.10')],
        },
      ],
      unresolved: [asFqdn('dead-b.example.com'), asFqdn('dead-a.example.com')],
      errors: [],
      generatedAt: new Date(),
    };
    const out = formatTable(report, { color: false });
    expect(out).toContain('unresolved');
    expect(out).toContain('dead-a.example.com');
    expect(out).toContain('dead-b.example.com');
    // unresolved sorted alphabetically: a comes before b
    const aPos = out.indexOf('dead-a.example.com');
    const bPos = out.indexOf('dead-b.example.com');
    expect(aPos).toBeLessThan(bPos);
    // The unresolved row is on the same line as the first unresolved FQDN
    expect(out).toMatch(/unresolved.*dead-a\.example\.com/);
    // No prefix "Unresolved (n): ..." line — moved into the table
    expect(out).not.toMatch(/Unresolved \(\d+\):/);
  });

  it('does not append unresolved row when none', () => {
    const report: DomainReport = {
      kind: 'domain-report',
      domain: asFqdn('example.com'),
      providers: [],
      groups: [
        {
          match: {
            rangeStart: asIpv4('5.0.0.0'),
            rangeEnd: asIpv4('5.0.255.255'),
            cidrs: ['5.0.0.0/16' as never],
            asn: { number: asAsNumber(12345), name: 'EXAMPLE-AS', country: 'RU' },
          },
          fqdns: [asFqdn('example.com')],
          ips: [asIpv4('5.0.0.10')],
        },
      ],
      unresolved: [],
      errors: [],
      generatedAt: new Date(),
    };
    const out = formatTable(report, { color: false });
    expect(out).not.toContain('unresolved');
  });
});
