import type { RangeMatchResult } from '../db/lookup.js';
import type { ResolveResult } from '../resolver/dns.js';
import type { EnumerateResult } from '../resolver/enumerate.js';
import type { Fqdn, Ipv4 } from '../types/brand.js';
import type { DomainGroup, DomainReport, RangeMatch } from '../types/domain.js';
import type { ProgressCallback } from '../types/progress.js';
import { pLimit } from './concurrency.js';

interface DomainLookupDeps {
  enumerate: (domain: Fqdn) => Promise<EnumerateResult>;
  resolve: (fqdn: Fqdn) => Promise<ResolveResult>;
  lookupIp: (ip: Ipv4) => RangeMatchResult | null;
  dnsConcurrency: number;
  onProgress?: ProgressCallback;
}

export async function lookupDomainImpl(
  domain: Fqdn,
  deps: DomainLookupDeps,
): Promise<DomainReport> {
  const enumeration = await deps.enumerate(domain);
  const limit = pLimit(deps.dnsConcurrency);

  const resolved: { fqdn: Fqdn; ips: readonly Ipv4[] }[] = [];
  const unresolved: Fqdn[] = [];
  const errors = [...enumeration.errors];

  const total = enumeration.fqdns.length;
  deps.onProgress?.({ kind: 'resolve-start', total });

  let resolvedCount = 0;
  let failedCount = 0;
  await Promise.all(
    enumeration.fqdns.map((fqdn) =>
      limit(async () => {
        const r = await deps.resolve(fqdn);
        if (r.ok) {
          resolved.push({ fqdn, ips: r.ips });
          resolvedCount++;
        } else {
          unresolved.push(fqdn);
          failedCount++;
        }
        deps.onProgress?.({
          kind: 'resolve-progress',
          resolved: resolvedCount,
          failed: failedCount,
          total,
        });
      }),
    ),
  );

  deps.onProgress?.({
    kind: 'resolve-end',
    resolved: resolvedCount,
    failed: failedCount,
  });

  // group by rangeStart-rangeEnd
  const groups = new Map<string, { match: RangeMatch; fqdns: Set<Fqdn>; ips: Set<Ipv4> }>();
  for (const { fqdn, ips } of resolved) {
    for (const ip of ips) {
      const m = deps.lookupIp(ip);
      if (!m) continue;
      const key = `${m.rangeStart}-${m.rangeEnd}`;
      let g = groups.get(key);
      if (!g) {
        g = { match: m, fqdns: new Set(), ips: new Set() };
        groups.set(key, g);
      }
      g.fqdns.add(fqdn);
      g.ips.add(ip);
    }
  }

  const groupList: DomainGroup[] = [];
  for (const g of groups.values()) {
    groupList.push({
      match: g.match,
      fqdns: [...g.fqdns],
      ips: [...g.ips],
    });
  }

  return {
    kind: 'domain-report',
    domain,
    providers: enumeration.providersUsed,
    groups: groupList,
    unresolved,
    errors,
    generatedAt: new Date(),
  };
}
