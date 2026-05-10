import { describe, expect, it } from 'vitest';
import { asAsNumber, asFqdn, asIpv4 } from '../../types/brand.js';
import type { FqdnLookup } from '../../types/domain.js';
import { formatCsv } from '../csv.js';

const sample: FqdnLookup = {
  kind: 'lookup-result',
  fqdn: asFqdn('api.example.com'),
  ips: [asIpv4('5.0.0.10')],
  matches: [
    {
      rangeStart: asIpv4('5.0.0.0'),
      rangeEnd: asIpv4('5.0.255.255'),
      cidrs: ['5.0.0.0/16' as never],
      asn: { number: asAsNumber(12345), name: 'EXAMPLE,AS', country: 'RU' },
    },
  ],
  generatedAt: new Date(),
};

describe('formatCsv', () => {
  it('emits header by default', () => {
    const out = formatCsv(sample);
    expect(out.startsWith('cidr,range_start,range_end,asn,asn_name,country,fqdns,ips')).toBe(true);
  });

  it('escapes commas with quotes', () => {
    const out = formatCsv(sample);
    expect(out).toContain('"EXAMPLE,AS"');
  });

  it('omits header when header=false', () => {
    const out = formatCsv(sample, { header: false });
    expect(out.startsWith('cidr,')).toBe(false);
  });

  it('escapes quotes by doubling', () => {
    const firstMatch = sample.matches[0];
    if (!firstMatch) throw new Error('test setup error');
    const noisy: FqdnLookup = {
      ...sample,
      matches: [
        {
          ...firstMatch,
          asn: { number: asAsNumber(1), name: 'has "quotes"', country: 'US' },
        },
      ],
    };
    const out = formatCsv(noisy);
    expect(out).toContain('"has ""quotes"""');
  });
});
