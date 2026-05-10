import { describe, expect, it, vi } from 'vitest';
import type { RangeMatchResult } from '../../db/lookup.js';
import type { ResolveResult } from '../../resolver/dns.js';
import type { EnumerateResult } from '../../resolver/enumerate.js';
import { asAsNumber, asFqdn, asIpv4 } from '../../types/brand.js';
import { lookupDomainImpl } from '../domain.js';

describe('lookupDomainImpl', () => {
  it('groups by RangeMatch', async () => {
    const enumerate = vi.fn(
      async (): Promise<EnumerateResult> => ({
        fqdns: [asFqdn('example.com'), asFqdn('api.example.com'), asFqdn('cdn.example.com')],
        errors: [],
        providersUsed: ['stub'],
      }),
    );
    const resolve = vi.fn(
      async (fqdn): Promise<ResolveResult> => ({
        ok: true,
        ips: [fqdn === asFqdn('cdn.example.com') ? asIpv4('93.184.216.34') : asIpv4('5.0.0.10')],
      }),
    );
    const sharedMatch: RangeMatchResult = {
      rangeStart: asIpv4('5.0.0.0'),
      rangeEnd: asIpv4('5.0.255.255'),
      cidrs: ['5.0.0.0/16' as never],
      asn: { number: asAsNumber(12345), name: 'EXAMPLE-AS', country: 'RU' },
    };
    const otherMatch: RangeMatchResult = {
      rangeStart: asIpv4('93.184.216.0'),
      rangeEnd: asIpv4('93.184.216.255'),
      cidrs: ['93.184.216.0/24' as never],
      asn: { number: asAsNumber(15133), name: 'EDGECAST', country: 'US' },
    };
    const lookupIp = vi.fn((ip) => (ip === '93.184.216.34' ? otherMatch : sharedMatch));

    const r = await lookupDomainImpl(asFqdn('example.com'), {
      enumerate,
      resolve,
      lookupIp,
      dnsConcurrency: 5,
    });
    expect(r.groups).toHaveLength(2);
    const group5 = r.groups.find((g) => g.match.asn.number === 12345);
    expect(group5?.fqdns).toEqual(expect.arrayContaining(['example.com', 'api.example.com']));
    const groupEdge = r.groups.find((g) => g.match.asn.number === 15133);
    expect(groupEdge?.fqdns).toEqual(['cdn.example.com']);
  });

  it('captures unresolved fqdns', async () => {
    const enumerate = vi.fn(
      async (): Promise<EnumerateResult> => ({
        fqdns: [asFqdn('example.com'), asFqdn('dead.example.com')],
        errors: [],
        providersUsed: [],
      }),
    );
    const resolve = vi.fn(async (fqdn): Promise<ResolveResult> => {
      if (fqdn === asFqdn('dead.example.com')) {
        return { ok: false, code: 'ENOTFOUND', message: 'not found' };
      }
      return { ok: true, ips: [asIpv4('1.2.3.4')] };
    });
    const lookupIp = vi.fn(() => null);
    const r = await lookupDomainImpl(asFqdn('example.com'), {
      enumerate,
      resolve,
      lookupIp,
      dnsConcurrency: 5,
    });
    expect(r.unresolved).toEqual(['dead.example.com']);
  });
});
