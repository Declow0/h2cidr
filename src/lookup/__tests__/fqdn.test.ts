import { describe, expect, it, vi } from 'vitest';
import type { RangeMatchResult } from '../../db/lookup.js';
import type { ResolveResult } from '../../resolver/dns.js';
import { asAsNumber, asFqdn, asIpv4 } from '../../types/brand.js';
import { lookupFqdnImpl } from '../fqdn.js';

const stubMatch = (): RangeMatchResult => ({
  rangeStart: asIpv4('5.0.0.0'),
  rangeEnd: asIpv4('5.0.255.255'),
  cidrs: ['5.0.0.0/16' as never],
  asn: { number: asAsNumber(12345), name: 'EXAMPLE-AS', country: 'RU' },
});

describe('lookupFqdnImpl', () => {
  it('resolves FQDN and returns deduped matches', async () => {
    const resolve = vi.fn(
      async (): Promise<ResolveResult> => ({
        ok: true,
        ips: [asIpv4('5.0.0.10'), asIpv4('5.0.0.11')],
      }),
    );
    const lookupIp = vi.fn((_ip) => stubMatch());

    const result = await lookupFqdnImpl(asFqdn('api.example.com'), { resolve, lookupIp });
    expect(result.ips).toEqual(['5.0.0.10', '5.0.0.11']);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.asn.number).toBe(12345);
  });

  it('returns empty matches if all IPs miss the database', async () => {
    const resolve = vi.fn(
      async (): Promise<ResolveResult> => ({
        ok: true,
        ips: [asIpv4('100.0.0.1')],
      }),
    );
    const lookupIp = vi.fn(() => null);
    const r = await lookupFqdnImpl(asFqdn('x.example.com'), { resolve, lookupIp });
    expect(r.matches).toEqual([]);
    expect(r.ips).toEqual(['100.0.0.1']);
  });

  it('throws DnsResolutionError on resolver failure', async () => {
    const resolve = vi.fn(
      async (): Promise<ResolveResult> => ({
        ok: false,
        code: 'ENOTFOUND',
        message: 'not found',
      }),
    );
    const lookupIp = vi.fn();
    await expect(lookupFqdnImpl(asFqdn('nope.example.com'), { resolve, lookupIp })).rejects.toThrow(
      /DNS resolution failed/,
    );
  });
});
