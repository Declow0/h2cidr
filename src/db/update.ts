import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import envPaths from 'env-paths';
import { NetworkError } from '../errors.js';
import { type CompactResult, compactTsv } from './compact.js';

export const IPTOASN_URL = 'https://iptoasn.com/data/ip2asn-v4.tsv.gz';

interface UpdateOptions {
  dataDir?: string;
  force?: boolean;
}

interface UpdateResult extends CompactResult {
  dataDir: string;
  dbPath: string;
  tsvPath: string;
}

export async function updateDatabase(opts: UpdateOptions = {}): Promise<UpdateResult> {
  const dataDir = opts.dataDir ?? envPaths('h2cidr', { suffix: '' }).cache;
  await fs.mkdir(dataDir, { recursive: true });
  const tsvGzPath = join(dataDir, 'ip2asn-v4.tsv.gz');
  const dbPath = join(dataDir, 'db.bin');

  const res = await fetch(IPTOASN_URL).catch((e) => {
    throw new NetworkError(IPTOASN_URL, String(e));
  });
  if (!res.ok) throw new NetworkError(IPTOASN_URL, `HTTP ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  await fs.writeFile(tsvGzPath, Buffer.from(arrayBuf));

  const result = await compactTsv({
    srcPath: tsvGzPath,
    dstPath: dbPath,
    force: opts.force ?? true,
    sourceTimestamp: new Date(),
  });

  return { ...result, dataDir, dbPath, tsvPath: tsvGzPath };
}
