import { describe, expect, it } from 'vitest';
import { asAsNumber, asCidr, asFqdn, asIpv4 } from '../brand.js';

describe('branded constructors', () => {
  it('asIpv4 accepts valid IPv4', () => {
    expect(asIpv4('1.2.3.4')).toBe('1.2.3.4');
    expect(asIpv4('0.0.0.0')).toBe('0.0.0.0');
    expect(asIpv4('255.255.255.255')).toBe('255.255.255.255');
  });

  it('asIpv4 rejects invalid', () => {
    expect(() => asIpv4('1.2.3')).toThrow();
    expect(() => asIpv4('256.0.0.0')).toThrow();
    expect(() => asIpv4('1.2.3.4.5')).toThrow();
    expect(() => asIpv4('a.b.c.d')).toThrow();
    expect(() => asIpv4('')).toThrow();
  });

  it('asFqdn accepts valid FQDN', () => {
    expect(asFqdn('example.com')).toBe('example.com');
    expect(asFqdn('sub.example.com')).toBe('sub.example.com');
    expect(asFqdn('a-b.c.d')).toBe('a-b.c.d');
    expect(asFqdn('Example.Com')).toBe('example.com');
  });

  it('asFqdn rejects invalid', () => {
    expect(() => asFqdn('')).toThrow();
    expect(() => asFqdn('-bad.com')).toThrow();
    expect(() => asFqdn('bad-.com')).toThrow();
    expect(() => asFqdn('a..b')).toThrow();
    expect(() => asFqdn(`${'a'.repeat(64)}.com`)).toThrow();
  });

  it('asCidr accepts valid', () => {
    expect(asCidr('1.2.3.0/24')).toBe('1.2.3.0/24');
    expect(asCidr('0.0.0.0/0')).toBe('0.0.0.0/0');
    expect(asCidr('1.2.3.4/32')).toBe('1.2.3.4/32');
  });

  it('asCidr rejects invalid', () => {
    expect(() => asCidr('1.2.3.0')).toThrow();
    expect(() => asCidr('1.2.3.0/33')).toThrow();
    expect(() => asCidr('1.2.3.0/-1')).toThrow();
    expect(() => asCidr('foo/24')).toThrow();
  });

  it('asAsNumber accepts non-negative integer', () => {
    expect(asAsNumber(0)).toBe(0);
    expect(asAsNumber(12345)).toBe(12345);
  });

  it('asAsNumber rejects invalid', () => {
    expect(() => asAsNumber(-1)).toThrow();
    expect(() => asAsNumber(1.5)).toThrow();
    expect(() => asAsNumber(Number.NaN)).toThrow();
  });
});
