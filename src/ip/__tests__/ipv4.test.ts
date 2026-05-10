import { describe, expect, it } from 'vitest';
import { asIpv4 } from '../../types/brand.js';
import { intToIp, ipToInt } from '../ipv4.js';

describe('ipv4 helpers', () => {
  it('ipToInt converts correctly', () => {
    expect(ipToInt(asIpv4('0.0.0.0'))).toBe(0);
    expect(ipToInt(asIpv4('1.2.3.4'))).toBe(0x01020304);
    expect(ipToInt(asIpv4('255.255.255.255'))).toBe(0xffffffff);
    expect(ipToInt(asIpv4('192.168.1.1'))).toBe(0xc0a80101);
  });

  it('intToIp reverses ipToInt', () => {
    expect(intToIp(0)).toBe('0.0.0.0');
    expect(intToIp(0x01020304)).toBe('1.2.3.4');
    expect(intToIp(0xffffffff)).toBe('255.255.255.255');
  });

  it('round-trips', () => {
    const samples = ['0.0.0.0', '1.2.3.4', '10.20.30.40', '255.255.255.255'];
    for (const s of samples) {
      expect(intToIp(ipToInt(asIpv4(s)))).toBe(s);
    }
  });
});
