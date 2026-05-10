import { describe, expect, it, vi } from 'vitest';
import { asFqdn } from '../../types/brand.js';
import { resolveFqdnA } from '../dns.js';

vi.mock('node:dns/promises', () => ({
  default: undefined,
  lookup: vi.fn(),
}));

import { lookup } from 'node:dns/promises';

describe('resolveFqdnA', () => {
  it('returns IPs on success', async () => {
    (lookup as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { address: '1.2.3.4', family: 4 },
      { address: '5.6.7.8', family: 4 },
    ]);
    const result = await resolveFqdnA(asFqdn('example.com'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ips).toEqual(['1.2.3.4', '5.6.7.8']);
  });

  it('returns error result on ENOTFOUND', async () => {
    const err = Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    (lookup as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);
    const result = await resolveFqdnA(asFqdn('nope.example.com'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('ENOTFOUND');
  });
});
