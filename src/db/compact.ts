import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { CompactionError } from '../errors.js';
import {
  ASN_RECORD_OFFSETS,
  ASN_RECORD_SIZE,
  FORMAT_VERSION,
  HEADER_OFFSETS,
  HEADER_SIZE,
  MAGIC_BYTES,
  RANGE_OFFSETS,
  RANGE_RECORD_SIZE,
} from './format.js';

interface CompactOptions {
  srcPath: string;
  dstPath: string;
  force?: boolean;
  sourceTimestamp?: Date;
}

export interface CompactResult {
  rangeCount: number;
  asnCount: number;
  bytesWritten: number;
}

interface ParsedRow {
  start: number;
  end: number;
  asn: number;
  country: string;
  name: string;
}

function ipv4ToInt(s: string): number {
  const parts = s.split('.');
  if (parts.length !== 4) throw new CompactionError(`bad IPv4: ${s}`);
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) throw new CompactionError(`bad octet in ${s}`);
    n = n * 256 + v;
  }
  return n >>> 0;
}

function parseLine(line: string, lineNo: number): ParsedRow | null {
  if (line.length === 0) return null;
  const parts = line.split('\t');
  if (parts.length < 5) {
    throw new CompactionError(`line ${lineNo}: expected 5 tab-separated fields`);
  }
  const s = parts[0] ?? '';
  const e = parts[1] ?? '';
  const a = parts[2] ?? '0';
  const c = parts[3] ?? '';
  const n = parts[4] ?? '';
  return {
    start: ipv4ToInt(s),
    end: ipv4ToInt(e),
    asn: Number.parseInt(a, 10) || 0,
    country: c,
    name: n,
  };
}

async function* iterateLines(src: string): AsyncGenerator<string> {
  let stream: Readable = createReadStream(src);
  if (src.endsWith('.gz')) stream = stream.pipe(createGunzip());
  const rl = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
  for await (const line of rl) {
    if (line.length > 0) yield line;
  }
}

export async function compactTsv(opts: CompactOptions): Promise<CompactResult> {
  if (!opts.force) {
    const exists = await fs
      .access(opts.dstPath)
      .then(() => true)
      .catch(() => false);
    if (exists) throw new CompactionError(`destination exists: ${opts.dstPath}`);
  }

  const rows: ParsedRow[] = [];
  let lineNo = 0;
  for await (const line of iterateLines(opts.srcPath)) {
    lineNo++;
    const row = parseLine(line, lineNo);
    if (row) rows.push(row);
  }
  rows.sort((a, b) => a.start - b.start);

  // Unique (asn, name, country) → index
  const asnMap = new Map<string, number>();
  const asnList: { asn: number; name: string; country: string }[] = [];
  for (const r of rows) {
    const key = `${r.asn} ${r.name} ${r.country}`;
    if (!asnMap.has(key)) {
      asnMap.set(key, asnList.length);
      asnList.push({ asn: r.asn, name: r.name, country: r.country });
    }
  }

  // String table: for each ASN — name+country, offset+lengths
  const stringChunks: Buffer[] = [];
  let stringPos = 0;
  const asnEntries: { asn: number; nameOffset: number; nameLen: number; countryLen: number }[] = [];
  for (const e of asnList) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const countryBuf = Buffer.from(e.country, 'utf8');
    if (nameBuf.length > 0xffff) throw new CompactionError(`name too long: ${e.name.slice(0, 40)}`);
    if (countryBuf.length > 0xffff) throw new CompactionError(`country too long: ${e.country}`);
    asnEntries.push({
      asn: e.asn,
      nameOffset: stringPos,
      nameLen: nameBuf.length,
      countryLen: countryBuf.length,
    });
    stringChunks.push(nameBuf, countryBuf);
    stringPos += nameBuf.length + countryBuf.length;
  }

  const rangesSize = rows.length * RANGE_RECORD_SIZE;
  const asnTableSize = asnEntries.length * ASN_RECORD_SIZE;
  const asnTableOffset = HEADER_SIZE + rangesSize;
  const stringTableOffset = asnTableOffset + asnTableSize;
  const stringTableSize = stringPos;
  const totalSize = stringTableOffset + stringTableSize;

  const buf = Buffer.alloc(totalSize);

  // Header
  MAGIC_BYTES.forEach((b, i) => {
    buf[i] = b;
  });
  buf.writeUInt32LE(FORMAT_VERSION, HEADER_OFFSETS.version);
  const ts = (opts.sourceTimestamp ?? new Date()).getTime();
  buf.writeBigUInt64LE(BigInt(ts), HEADER_OFFSETS.sourceTimestamp);
  buf.writeUInt32LE(rows.length, HEADER_OFFSETS.rangeCount);
  buf.writeUInt32LE(asnEntries.length, HEADER_OFFSETS.asnCount);
  buf.writeUInt32LE(asnTableOffset, HEADER_OFFSETS.asnTableOffset);
  buf.writeUInt32LE(stringTableOffset, HEADER_OFFSETS.stringTableOffset);

  // Ranges
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const off = HEADER_SIZE + i * RANGE_RECORD_SIZE;
    const key = `${r.asn} ${r.name} ${r.country}`;
    const idx = asnMap.get(key) ?? 0;
    buf.writeUInt32LE(r.start >>> 0, off + RANGE_OFFSETS.start);
    buf.writeUInt32LE(r.end >>> 0, off + RANGE_OFFSETS.end);
    buf.writeUInt32LE(idx, off + RANGE_OFFSETS.asnIndex);
    buf.writeUInt32LE(0, off + RANGE_OFFSETS.flags);
  }

  // ASN table
  for (let i = 0; i < asnEntries.length; i++) {
    const e = asnEntries[i];
    if (!e) continue;
    const off = asnTableOffset + i * ASN_RECORD_SIZE;
    buf.writeUInt32LE(e.asn, off + ASN_RECORD_OFFSETS.number);
    buf.writeUInt32LE(e.nameOffset, off + ASN_RECORD_OFFSETS.nameOffset);
    buf.writeUInt16LE(e.nameLen, off + ASN_RECORD_OFFSETS.nameLength);
    buf.writeUInt16LE(e.countryLen, off + ASN_RECORD_OFFSETS.countryLength);
  }

  // String table
  let pos = stringTableOffset;
  for (const c of stringChunks) {
    c.copy(buf, pos);
    pos += c.length;
  }

  // Atomic write via temp + rename
  const tmpPath = `${opts.dstPath}.tmp`;
  await fs.writeFile(tmpPath, buf);
  await fs.rename(tmpPath, opts.dstPath);

  return { rangeCount: rows.length, asnCount: asnEntries.length, bytesWritten: totalSize };
}
