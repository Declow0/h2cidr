import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { asIpv4 } from '../../types/brand.js';
import { compactTsv } from '../compact.js';
import { openDatabase } from '../load.js';

const FIXTURE = join(import.meta.dirname, '..', '..', '..', 'test', 'fixtures', 'iptoasn-mini.tsv');

describe('openDatabase + lookupIp', () => {
  let tmp: string;
  let dbPath: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), 'h2c-load-'));
    dbPath = join(tmp, 'db.bin');
    await compactTsv({ srcPath: FIXTURE, dstPath: dbPath });
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('throws DbNotFoundError when file is missing', async () => {
    const { openDatabase: open } = await import('../load.js');
    expect(() => open({ path: join(tmp, 'missing.bin') })).toThrow(/Database not found/);
  });

  it('looks up known IP', () => {
    const db = openDatabase({ path: dbPath });
    const m = db.lookupIp(asIpv4('1.0.0.5'));
    expect(m).not.toBeNull();
    expect(m?.asn.number).toBe(13335);
    expect(m?.asn.name).toBe('CLOUDFLARENET');
    expect(m?.cidrs).toEqual(['1.0.0.0/24']);
    db.close();
  });

  it('returns null for IP outside any range', () => {
    const db = openDatabase({ path: dbPath });
    expect(db.lookupIp(asIpv4('200.0.0.1'))).toBeNull();
    db.close();
  });

  it('finds aggregated /16', () => {
    const db = openDatabase({ path: dbPath });
    const m = db.lookupIp(asIpv4('5.0.0.10'));
    expect(m?.asn.number).toBe(12345);
    expect(m?.cidrs).toEqual(['5.0.0.0/16']);
    db.close();
  });

  it('exposes metadata', () => {
    const db = openDatabase({ path: dbPath });
    expect(db.metadata.rangeCount).toBe(6);
    expect(db.metadata.version).toBe(1);
    expect(db.metadata.sourceTimestamp).toBeInstanceOf(Date);
    db.close();
  });
});
