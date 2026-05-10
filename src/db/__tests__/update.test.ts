import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IPTOASN_URL, updateDatabase } from '../update.js';

const SAMPLE_TSV = [
  '1.0.0.0\t1.0.0.255\t13335\tUS\tCLOUDFLARENET',
  '5.0.0.0\t5.0.255.255\t12345\tRU\tEXAMPLE-AS',
].join('\n');

describe('updateDatabase', () => {
  let dataDir: string;
  beforeEach(async () => {
    dataDir = await fs.mkdtemp(join(tmpdir(), 'h2c-upd-'));
  });
  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it('downloads, gunzips, and compacts', async () => {
    const gz = gzipSync(Buffer.from(SAMPLE_TSV));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(url).toBe(IPTOASN_URL);
        return new Response(gz, {
          status: 200,
          headers: { 'last-modified': new Date().toUTCString() },
        });
      }),
    );

    const result = await updateDatabase({ dataDir, force: true });
    expect(result.rangeCount).toBe(2);
    const dbPath = join(dataDir, 'db.bin');
    expect((await fs.stat(dbPath)).size).toBeGreaterThan(32);
  });

  it('throws NetworkError on non-200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad', { status: 500 })),
    );
    await expect(updateDatabase({ dataDir, force: true })).rejects.toThrow(/Network/);
  });
});
