import { describe, expect, it } from 'vitest';
import {
  CompactionError,
  DbNotFoundError,
  DnsResolutionError,
  HostnameToCidrError,
  InvalidFqdnError,
  InvalidIpError,
  NetworkError,
  ProviderError,
} from '../errors.js';

describe('error hierarchy', () => {
  it('all extend HostnameToCidrError and have stable codes', () => {
    const cases: [HostnameToCidrError, string][] = [
      [new DbNotFoundError('/x'), 'DB_NOT_FOUND'],
      [new InvalidFqdnError('bad'), 'INVALID_FQDN'],
      [new InvalidIpError('bad'), 'INVALID_IP'],
      [new DnsResolutionError('bad', 'ENOTFOUND'), 'DNS_RESOLUTION'],
      [new ProviderError('crtsh', 'timeout'), 'PROVIDER_FAILED'],
      [new CompactionError('bad row'), 'COMPACTION_FAILED'],
      [new NetworkError('GET failed'), 'NETWORK_ERROR'],
    ];
    for (const [err, code] of cases) {
      expect(err).toBeInstanceOf(HostnameToCidrError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe(code);
      expect(err.message.length).toBeGreaterThan(0);
    }
  });

  it('DbNotFoundError exposes path', () => {
    const e = new DbNotFoundError('/var/db.bin');
    expect(e.path).toBe('/var/db.bin');
  });
});
