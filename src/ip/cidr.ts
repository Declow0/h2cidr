import type { Cidr, Ipv4Int } from '../types/brand.js';
import { intToIp } from './ipv4.js';

function ctz32(v: number): number {
  if (v === 0) return 32;
  let n = 0;
  let x = v >>> 0;
  if ((x & 0xffff) === 0) {
    n += 16;
    x >>>= 16;
  }
  if ((x & 0xff) === 0) {
    n += 8;
    x >>>= 8;
  }
  if ((x & 0xf) === 0) {
    n += 4;
    x >>>= 4;
  }
  if ((x & 0x3) === 0) {
    n += 2;
    x >>>= 2;
  }
  if ((x & 0x1) === 0) {
    n += 1;
  }
  return n;
}

function clz32(v: number): number {
  if (v === 0) return 32;
  return Math.clz32(v >>> 0);
}

export function rangeToCidrs(start: Ipv4Int | number, end: Ipv4Int | number): Cidr[] {
  const result: Cidr[] = [];
  let cur = start >>> 0;
  const stop = end >>> 0;
  while (cur <= stop) {
    const maxByAlign = cur === 0 ? 32 : ctz32(cur);
    const remaining = (stop - cur + 1) >>> 0;
    // floor(log2(remaining)): largest power-of-2 block that fits in [cur, stop]
    const maxByCount = remaining === 0 ? 32 : 31 - clz32(remaining);
    const blockBits = Math.min(maxByAlign, maxByCount);
    const prefix = 32 - blockBits;
    result.push(`${intToIp(cur as Ipv4Int)}/${prefix}` as Cidr);
    const blockSize = blockBits === 32 ? 0x100000000 : (1 << blockBits) >>> 0;
    cur = (cur + blockSize) >>> 0;
    if (cur === 0) break; // overflow past 0xFFFFFFFF
  }
  return result;
}

export function prefixLenToMask(prefix: number): string {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid prefix length: ${prefix}`);
  }
  if (prefix === 0) return '0.0.0.0';
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  const a = (mask >>> 24) & 0xff;
  const b = (mask >>> 16) & 0xff;
  const c = (mask >>> 8) & 0xff;
  const d = mask & 0xff;
  return `${a}.${b}.${c}.${d}`;
}
