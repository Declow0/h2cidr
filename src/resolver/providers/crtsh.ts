import { z } from 'zod';
import { ProviderError } from '../../errors.js';
import { type Fqdn, asFqdn } from '../../types/brand.js';
import type { ProviderEnumerateOptions, SubdomainProvider } from './types.js';

// biome-ignore lint/style/useNamingConvention: name_value is the crt.sh JSON API field name
const CrtShEntry = z.object({ name_value: z.string() });
const CrtShResponse = z.array(CrtShEntry);

const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [];
const TRANSIENT_STATUSES = new Set([404, 408, 425, 429, 500, 502, 503, 504]);

interface CrtShProviderOptions {
  retryDelaysMs?: readonly number[];
}

export class CrtShProvider implements SubdomainProvider {
  readonly name = 'crtsh';
  readonly requiresApiKey = false;
  private readonly retryDelaysMs: readonly number[];

  constructor(options: CrtShProviderOptions = {}) {
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  }

  async enumerate(domain: Fqdn, opts: ProviderEnumerateOptions): Promise<readonly Fqdn[]> {
    // q=%.<domain> (URL-encoded %25) is a SQL LIKE wildcard that matches every
    // subdomain at any depth — recursive enumeration. The exact-match form
    // (q=<domain>) only returns certs whose CN/SAN equals <domain>, missing
    // children. crt.sh is flaky under load (502/504/timeout/sometimes 404),
    // so transient failures are retried with backoff.
    const url = `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`;

    const json = await fetchWithRetry(url, this.name, this.retryDelaysMs, opts);
    const parsed = CrtShResponse.safeParse(json);
    if (!parsed.success) throw new ProviderError(this.name, 'invalid response shape');

    const out = new Set<string>();
    for (const entry of parsed.data) {
      for (const raw of entry.name_value.split('\n')) {
        const trimmed = raw.trim().toLowerCase().replace(/^\*\./, '');
        if (trimmed.length === 0) continue;
        if (trimmed === domain) continue;
        try {
          out.add(asFqdn(trimmed));
        } catch {
          // invalid — ignore
        }
      }
    }
    return [...out] as Fqdn[];
  }
}

async function fetchWithRetry(
  url: string,
  providerName: string,
  retryDelaysMs: readonly number[],
  opts: ProviderEnumerateOptions,
): Promise<unknown> {
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    if (attempt > 0) {
      const delay = retryDelaysMs[attempt - 1] ?? 0;
      if (delay > 0) {
        try {
          await sleepUntilSignal(delay, opts.signal);
        } catch (e: unknown) {
          throw new ProviderError(providerName, e instanceof Error ? e.message : String(e));
        }
      }
    }

    const timer = opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined;
    const signal = timer ? AbortSignal.any([opts.signal, timer]) : opts.signal;

    try {
      const res = await fetch(url, { signal });
      if (res.ok) return await res.json();
      if (TRANSIENT_STATUSES.has(res.status) && attempt < retryDelaysMs.length) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      throw new ProviderError(providerName, `HTTP ${res.status}`);
    } catch (e: unknown) {
      if (opts.signal.aborted) {
        throw new ProviderError(providerName, 'aborted');
      }
      if (e instanceof ProviderError) throw e;
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt >= retryDelaysMs.length) {
        throw new ProviderError(providerName, lastErr.message);
      }
    }
  }
  throw new ProviderError(providerName, lastErr?.message ?? 'unknown error');
}

function sleepUntilSignal(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(t);
      reject(new Error('aborted'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
