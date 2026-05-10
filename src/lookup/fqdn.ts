import type { RangeMatchResult } from '../db/lookup.js';
import { DnsResolutionError } from '../errors.js';
import type { ResolveResult } from '../resolver/dns.js';
import type { Fqdn, Ipv4 } from '../types/brand.js';
import type { FqdnLookup, RangeMatch } from '../types/domain.js';

interface FqdnLookupDeps {
  resolve: (fqdn: Fqdn) => Promise<ResolveResult>;
  lookupIp: (ip: Ipv4) => RangeMatchResult | null;
}

export async function lookupFqdnImpl(fqdn: Fqdn, deps: FqdnLookupDeps): Promise<FqdnLookup> {
  const r = await deps.resolve(fqdn);
  if (!r.ok) throw new DnsResolutionError(fqdn, r.message);
  const matches = new Map<string, RangeMatch>();
  for (const ip of r.ips) {
    const m = deps.lookupIp(ip);
    if (m) matches.set(`${m.rangeStart}-${m.rangeEnd}`, m);
  }
  return {
    kind: 'lookup-result',
    fqdn,
    ips: r.ips,
    matches: [...matches.values()],
    generatedAt: new Date(),
  };
}
