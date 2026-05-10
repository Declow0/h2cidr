import { describe, expect, it } from 'vitest';
import { asAsNumber, asFqdn, asIpv4 } from '../../types/brand.js';
import type { FqdnLookup } from '../../types/domain.js';
import { formatKeenetic } from '../keenetic.js';

const sample: FqdnLookup = {
  kind: 'lookup-result',
  fqdn: asFqdn('api.example.com'),
  ips: [asIpv4('3.0.0.10')],
  matches: [
    {
      rangeStart: asIpv4('3.0.0.0'),
      rangeEnd: asIpv4('3.127.255.255'),
      cidrs: ['3.0.0.0/9' as never],
      asn: { number: asAsNumber(16509), name: 'AMAZON-02', country: 'US' },
    },
  ],
  generatedAt: new Date(),
};

describe('formatKeenetic', () => {
  it('emits @echo off and route add lines', () => {
    const out = formatKeenetic(sample);
    expect(out).toContain('@echo off');
    expect(out).toContain('route add 3.0.0.0 mask 255.128.0.0 0.0.0.0');
  });

  it('uses CRLF by default', () => {
    const out = formatKeenetic(sample);
    expect(out.includes('\r\n')).toBe(true);
  });

  it('respects --gateway', () => {
    const out = formatKeenetic(sample, { gateway: asIpv4('10.0.0.1') });
    expect(out).toContain('route add 3.0.0.0 mask 255.128.0.0 10.0.0.1');
  });

  it('annotate adds :: comment with ASN/FQDN', () => {
    const out = formatKeenetic(sample, { annotate: true });
    expect(out).toMatch(/:: ASN16509 AMAZON-02/);
    expect(out).toContain('api.example.com');
  });

  it('eol=lf produces no CR', () => {
    const out = formatKeenetic(sample, { eol: 'lf' });
    expect(out.includes('\r')).toBe(false);
  });
});
