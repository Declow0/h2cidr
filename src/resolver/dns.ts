import { lookup } from 'node:dns/promises';
import type { Fqdn, Ipv4 } from '../types/brand.js';
import { asIpv4 } from '../types/brand.js';

export type ResolveResult =
  | { ok: true; ips: readonly Ipv4[] }
  | { ok: false; code: string; message: string };

export async function resolveFqdnA(fqdn: Fqdn): Promise<ResolveResult> {
  try {
    const entries = await lookup(fqdn, { all: true, family: 4 });
    const ips = entries.map((e) => asIpv4(e.address));
    return { ok: true, ips };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    return {
      ok: false,
      code: err.code ?? 'UNKNOWN',
      message: err.message ?? String(e),
    };
  }
}
