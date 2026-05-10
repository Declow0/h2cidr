import type { Fqdn } from '../types/brand.js';
import { asFqdn } from '../types/brand.js';
import type { ProgressCallback } from '../types/progress.js';
import type { SubdomainProvider } from './providers/types.js';

interface EnumerateOptions {
  providers: readonly SubdomainProvider[];
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: ProgressCallback;
}

export interface EnumerateResult {
  fqdns: readonly Fqdn[];
  errors: readonly { source: string; message: string }[];
  providersUsed: readonly string[];
}

type ProviderOutcome =
  | { ok: true; name: string; fqdns: readonly Fqdn[] }
  | { ok: false; name: string; message: string };

export async function enumerateSubdomains(
  domain: Fqdn,
  opts: EnumerateOptions,
): Promise<EnumerateResult> {
  const signal = opts.signal ?? new AbortController().signal;
  opts.onProgress?.({ kind: 'enumerate-start', providers: opts.providers.map((p) => p.name) });

  const outcomes = await Promise.all(
    opts.providers.map(async (p): Promise<ProviderOutcome> => {
      const start = Date.now();
      opts.onProgress?.({ kind: 'provider-start', provider: p.name });
      try {
        const fqdns = await p.enumerate(domain, {
          signal,
          ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
        });
        opts.onProgress?.({
          kind: 'provider-end',
          provider: p.name,
          count: fqdns.length,
          durationMs: Date.now() - start,
        });
        return { ok: true, name: p.name, fqdns };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        opts.onProgress?.({
          kind: 'provider-error',
          provider: p.name,
          message,
          durationMs: Date.now() - start,
        });
        return { ok: false, name: p.name, message };
      }
    }),
  );

  const errors: { source: string; message: string }[] = [];
  const providersUsed: string[] = [];
  const fqdns = new Set<string>([domain]); // apex always included
  for (const r of outcomes) {
    if (!r.ok) {
      errors.push({ source: r.name, message: r.message });
      continue;
    }
    providersUsed.push(r.name);
    for (const f of r.fqdns) {
      // keep only subdomains of the requested apex
      if (f === domain || f.endsWith(`.${domain}`)) fqdns.add(f);
    }
  }

  const out: Fqdn[] = [];
  for (const s of fqdns) {
    try {
      out.push(asFqdn(s));
    } catch {
      /* skip invalid */
    }
  }
  return { fqdns: out, errors, providersUsed };
}
