import type { Fqdn } from '../../types/brand.js';

export interface ProviderEnumerateOptions {
  signal: AbortSignal;
  timeoutMs?: number;
}

export interface SubdomainProvider {
  readonly name: string;
  readonly requiresApiKey: boolean;
  readonly apiKeyEnvVar?: string;
  enumerate(domain: Fqdn, opts: ProviderEnumerateOptions): Promise<readonly Fqdn[]>;
}
