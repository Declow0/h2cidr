import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { asAsNumber, asFqdn, asIpv4 } from '../../types/brand.js';
import type { DomainReport } from '../../types/domain.js';
import { formatJson } from '../json.js';
import { formatYaml } from '../yaml.js';

const sample: DomainReport = {
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
  unresolved: [],
  errors: [],
  generatedAt: new Date('2026-05-10T12:00:00Z'),
};

describe('formatJson', () => {
  it('round-trips through JSON.parse', () => {
    const text = formatJson(sample);
    const parsed: unknown = JSON.parse(text);
    expect(parsed).toMatchObject({
      kind: 'domain-report',
      domain: 'example.com',
      providers: ['stub'],
    });
  });

  it('serializes generatedAt as ISO string', () => {
    expect(formatJson(sample)).toContain('"2026-05-10T12:00:00.000Z"');
  });
});

describe('formatYaml', () => {
  it('produces parseable YAML', () => {
    const text = formatYaml(sample);
    const parsed: unknown = parseYaml(text);
    expect(parsed).toMatchObject({ kind: 'domain-report', domain: 'example.com' });
  });
});
