import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { compactTsv } from '../compact.js';
import { FORMAT_VERSION, HEADER_OFFSETS, MAGIC_BYTES } from '../format.js';

const FIXTURE = join(import.meta.dirname, '..', '..', '..', 'test', 'fixtures', 'iptoasn-mini.tsv');

describe('compactTsv', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), 'h2c-compact-'));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('produces a valid bin file from fixture', async () => {
    const dst = join(tmp, 'db.bin');
    const result = await compactTsv({ srcPath: FIXTURE, dstPath: dst });
    expect(result.rangeCount).toBe(6);
    expect(result.asnCount).toBeGreaterThan(0);

    const buf = await fs.readFile(dst);
    // magic
    expect(Array.from(buf.subarray(0, 4))).toEqual(Array.from(MAGIC_BYTES));
    // version
    const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    expect(v.getUint32(HEADER_OFFSETS.version, true)).toBe(FORMAT_VERSION);
    expect(v.getUint32(HEADER_OFFSETS.rangeCount, true)).toBe(6);
  });

  it('refuses to overwrite without force', async () => {
    const dst = join(tmp, 'db.bin');
    await compactTsv({ srcPath: FIXTURE, dstPath: dst });
    await expect(compactTsv({ srcPath: FIXTURE, dstPath: dst })).rejects.toThrow(/exists/);
  });

  it('overwrites with force=true', async () => {
    const dst = join(tmp, 'db.bin');
    await compactTsv({ srcPath: FIXTURE, dstPath: dst });
    await expect(
      compactTsv({ srcPath: FIXTURE, dstPath: dst, force: true }),
    ).resolves.toMatchObject({ rangeCount: 6 });
  });
});
