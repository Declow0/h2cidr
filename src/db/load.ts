import { existsSync, readFileSync } from 'node:fs';
import envPaths from 'env-paths';
import { DbNotFoundError } from '../errors.js';
import { lookupDomainImpl } from '../lookup/domain.js';
import { lookupFqdnImpl } from '../lookup/fqdn.js';
import { resolveFqdnA } from '../resolver/dns.js';
import { enumerateSubdomains } from '../resolver/enumerate.js';
import type { SubdomainProvider } from '../resolver/providers/types.js';
import type { Fqdn, Ipv4 } from '../types/brand.js';
import { asAsNumber } from '../types/brand.js';
import type { AsnRecord, DomainReport, FqdnLookup } from '../types/domain.js';
import type { ProgressCallback } from '../types/progress.js';
import {
  ASN_RECORD_OFFSETS,
  ASN_RECORD_SIZE,
  FORMAT_VERSION,
  HEADER_OFFSETS,
  HEADER_SIZE,
  MAGIC_BYTES,
} from './format.js';
import { type RangeMatchResult, lookupIpInBuffer } from './lookup.js';

interface OpenDatabaseOptions {
  path?: string;
}

export interface DatabaseMetadata {
  readonly rangeCount: number;
  readonly sourceTimestamp: Date;
  readonly version: number;
}

interface DomainLookupCallOptions {
  providers?: readonly SubdomainProvider[];
  dnsConcurrency?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: ProgressCallback;
}

interface Database {
  lookupIp(ip: Ipv4): RangeMatchResult | null;
  lookupFqdn(fqdn: Fqdn): Promise<FqdnLookup>;
  lookupDomain(domain: Fqdn, opts?: DomainLookupCallOptions): Promise<DomainReport>;
  close(): void;
  readonly metadata: DatabaseMetadata;
}

export interface LoadedDb {
  buffer: Buffer;
  view: DataView;
  rangeCount: number;
  asnCount: number;
  asnTableOffset: number;
  stringTableOffset: number;
  metadata: DatabaseMetadata;
  asnRecord(index: number): AsnRecord;
}

export function loadDb(path: string): LoadedDb {
  if (!existsSync(path)) throw new DbNotFoundError(path);
  const buffer = readFileSync(path);
  if (buffer.length < HEADER_SIZE) throw new DbNotFoundError(path);
  if (!buffer.subarray(0, MAGIC_BYTES.length).equals(MAGIC_BYTES)) {
    throw new DbNotFoundError(path);
  }
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const version = view.getUint32(HEADER_OFFSETS.version, true);
  if (version !== FORMAT_VERSION) {
    throw new DbNotFoundError(`${path} (unsupported format version ${version})`);
  }
  const rangeCount = view.getUint32(HEADER_OFFSETS.rangeCount, true);
  const asnCount = view.getUint32(HEADER_OFFSETS.asnCount, true);
  const asnTableOffset = view.getUint32(HEADER_OFFSETS.asnTableOffset, true);
  const stringTableOffset = view.getUint32(HEADER_OFFSETS.stringTableOffset, true);
  const tsMs = Number(view.getBigUint64(HEADER_OFFSETS.sourceTimestamp, true));

  const metadata: DatabaseMetadata = {
    rangeCount,
    sourceTimestamp: new Date(tsMs),
    version,
  };

  const asnCache = new Map<number, AsnRecord>();
  function asnRecord(index: number): AsnRecord {
    const cached = asnCache.get(index);
    if (cached) return cached;
    if (index < 0 || index >= asnCount) {
      throw new Error(`asn index out of range: ${index}`);
    }
    const off = asnTableOffset + index * ASN_RECORD_SIZE;
    const number = view.getUint32(off + ASN_RECORD_OFFSETS.number, true);
    const nameOff = view.getUint32(off + ASN_RECORD_OFFSETS.nameOffset, true);
    const nameLen = view.getUint16(off + ASN_RECORD_OFFSETS.nameLength, true);
    const countryLen = view.getUint16(off + ASN_RECORD_OFFSETS.countryLength, true);
    const nameStart = stringTableOffset + nameOff;
    const name = buffer.toString('utf8', nameStart, nameStart + nameLen);
    const country = buffer.toString('utf8', nameStart + nameLen, nameStart + nameLen + countryLen);
    const rec: AsnRecord = { number: asAsNumber(number), name, country };
    asnCache.set(index, rec);
    return rec;
  }

  return {
    buffer,
    view,
    rangeCount,
    asnCount,
    asnTableOffset,
    stringTableOffset,
    metadata,
    asnRecord,
  };
}

export function openDatabase(opts: OpenDatabaseOptions = {}): Database {
  const path = opts.path ?? defaultDbPath();
  const loaded = loadDb(path);
  return {
    metadata: loaded.metadata,
    lookupIp(ip) {
      return lookupIpInBuffer(loaded, ip);
    },
    async lookupFqdn(fqdn) {
      return lookupFqdnImpl(fqdn, {
        resolve: resolveFqdnA,
        lookupIp: (ip) => lookupIpInBuffer(loaded, ip),
      });
    },
    async lookupDomain(domain, opts = {}) {
      const enumOpts = {
        providers: opts.providers ?? [],
        ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
        ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
        ...(opts.onProgress !== undefined ? { onProgress: opts.onProgress } : {}),
      };
      return lookupDomainImpl(domain, {
        enumerate: (d) => enumerateSubdomains(d, enumOpts),
        resolve: resolveFqdnA,
        lookupIp: (ip) => lookupIpInBuffer(loaded, ip),
        dnsConcurrency: opts.dnsConcurrency ?? 20,
        ...(opts.onProgress !== undefined ? { onProgress: opts.onProgress } : {}),
      });
    },
    close() {
      /* buffer GC'd when references drop */
    },
  };
}

export function defaultDbPath(): string {
  const paths = envPaths('h2cidr', { suffix: '' });
  return `${paths.cache}/db.bin`;
}
