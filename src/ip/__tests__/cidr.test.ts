import { describe, expect, it } from 'vitest';
import { asIpv4 } from '../../types/brand.js';
import { prefixLenToMask, rangeToCidrs } from '../cidr.js';
import { ipToInt } from '../ipv4.js';

describe('rangeToCidrs', () => {
  const range = (s: string, e: string) =>
    rangeToCidrs(ipToInt(asIpv4(s)), ipToInt(asIpv4(e))).map(String);

  it('exact /24', () => {
    expect(range('1.2.3.0', '1.2.3.255')).toEqual(['1.2.3.0/24']);
  });

  it('exact /16', () => {
    expect(range('5.0.0.0', '5.0.255.255')).toEqual(['5.0.0.0/16']);
  });

  it('single host /32', () => {
    expect(range('1.2.3.4', '1.2.3.4')).toEqual(['1.2.3.4/32']);
  });

  it('full /0', () => {
    expect(range('0.0.0.0', '255.255.255.255')).toEqual(['0.0.0.0/0']);
  });

  it('unaligned range emits multiple CIDRs', () => {
    expect(range('1.2.3.0', '1.2.4.255')).toEqual(['1.2.3.0/24', '1.2.4.0/24']);
  });

  it('handles consecutive /24s as /23', () => {
    expect(range('1.2.4.0', '1.2.5.255')).toEqual(['1.2.4.0/23']);
  });

  it('non-power-of-two range', () => {
    expect(range('1.2.3.0', '1.2.3.4')).toEqual(['1.2.3.0/30', '1.2.3.4/32']);
  });

  it('range starting on odd boundary', () => {
    expect(range('1.2.3.7', '1.2.3.10')).toEqual(['1.2.3.7/32', '1.2.3.8/31', '1.2.3.10/32']);
  });
});

describe('prefixLenToMask', () => {
  it.each([
    [0, '0.0.0.0'],
    [1, '128.0.0.0'],
    [8, '255.0.0.0'],
    [9, '255.128.0.0'],
    [16, '255.255.0.0'],
    [24, '255.255.255.0'],
    [32, '255.255.255.255'],
  ])('prefix %i -> %s', (prefix, mask) => {
    expect(prefixLenToMask(prefix)).toBe(mask);
  });

  it('rejects out-of-range', () => {
    expect(() => prefixLenToMask(-1)).toThrow();
    expect(() => prefixLenToMask(33)).toThrow();
  });
});
