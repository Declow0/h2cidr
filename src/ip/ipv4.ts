import type { Ipv4, Ipv4Int } from '../types/brand.js';

export function ipToInt(ip: Ipv4): Ipv4Int {
  const parts = ip.split('.');
  const [aPart, bPart, cPart, dPart] = parts;
  if (aPart === undefined || bPart === undefined || cPart === undefined || dPart === undefined) {
    throw new Error('unreachable: asIpv4 ensures 4 parts');
  }
  const a = Number(aPart);
  const b = Number(bPart);
  const c = Number(cPart);
  const d = Number(dPart);
  return (((a << 24) | (b << 16) | (c << 8) | d) >>> 0) as Ipv4Int;
}

export function intToIp(n: Ipv4Int | number): Ipv4 {
  const v = n >>> 0;
  const a = (v >>> 24) & 0xff;
  const b = (v >>> 16) & 0xff;
  const c = (v >>> 8) & 0xff;
  const d = v & 0xff;
  return `${a}.${b}.${c}.${d}` as Ipv4;
}
