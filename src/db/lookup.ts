import { rangeToCidrs } from '../ip/cidr.js';
import { intToIp, ipToInt } from '../ip/ipv4.js';
import type { Cidr, Ipv4 } from '../types/brand.js';
import type { AsnRecord } from '../types/domain.js';
import { HEADER_SIZE, RANGE_OFFSETS, RANGE_RECORD_SIZE } from './format.js';
import type { LoadedDb } from './load.js';

export interface RangeMatchResult {
  readonly rangeStart: Ipv4;
  readonly rangeEnd: Ipv4;
  readonly cidrs: readonly Cidr[];
  readonly asn: AsnRecord;
}

export function lookupIpInBuffer(db: LoadedDb, ip: Ipv4): RangeMatchResult | null {
  const target = ipToInt(ip);
  const view = db.view;
  let lo = 0;
  let hi = db.rangeCount - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const off = HEADER_SIZE + mid * RANGE_RECORD_SIZE;
    const start = view.getUint32(off + RANGE_OFFSETS.start, true);
    if (start <= target) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return null;
  const off = HEADER_SIZE + found * RANGE_RECORD_SIZE;
  const start = view.getUint32(off + RANGE_OFFSETS.start, true);
  const end = view.getUint32(off + RANGE_OFFSETS.end, true);
  if (target < start || target > end) return null;
  const asnIndex = view.getUint32(off + RANGE_OFFSETS.asnIndex, true);
  const asn = db.asnRecord(asnIndex);
  // ASN 0 = "Not routed" — filter as "not found"
  if (asn.number === 0) return null;
  return {
    rangeStart: intToIp(start),
    rangeEnd: intToIp(end),
    cidrs: rangeToCidrs(start, end),
    asn,
  };
}
