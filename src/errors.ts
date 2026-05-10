export abstract class HostnameToCidrError extends Error {
  abstract readonly code: string;
  override get name(): string {
    return this.constructor.name;
  }
}

export class DbNotFoundError extends HostnameToCidrError {
  readonly code = 'DB_NOT_FOUND';
  constructor(public readonly path: string) {
    super(`Database not found at ${path}. Run "h2cidr update".`);
  }
}

export class InvalidFqdnError extends HostnameToCidrError {
  readonly code = 'INVALID_FQDN';
  constructor(public readonly input: string) {
    super(`Invalid FQDN: ${input}`);
  }
}

export class InvalidIpError extends HostnameToCidrError {
  readonly code = 'INVALID_IP';
  constructor(public readonly input: string) {
    super(`Invalid IPv4: ${input}`);
  }
}

export class DnsResolutionError extends HostnameToCidrError {
  readonly code = 'DNS_RESOLUTION';
  constructor(
    public readonly fqdn: string,
    public readonly reason: string,
  ) {
    super(`DNS resolution failed for ${fqdn}: ${reason}`);
  }
}

export class ProviderError extends HostnameToCidrError {
  readonly code = 'PROVIDER_FAILED';
  constructor(
    public readonly provider: string,
    public readonly reason: string,
  ) {
    super(`Provider ${provider} failed: ${reason}`);
  }
}

export class CompactionError extends HostnameToCidrError {
  readonly code = 'COMPACTION_FAILED';
  constructor(message: string) {
    super(`Compaction failed: ${message}`);
  }
}

export class NetworkError extends HostnameToCidrError {
  readonly code = 'NETWORK_ERROR';
  constructor(
    public readonly url: string,
    public readonly reason: string = '',
  ) {
    super(`Network error for ${url}${reason ? `: ${reason}` : ''}`);
  }
}
