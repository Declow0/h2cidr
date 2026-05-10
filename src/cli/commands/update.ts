import { promises as fs } from 'node:fs';
import { Command } from 'commander';
import { IPTOASN_URL, updateDatabase } from '../../db/index.js';
import { handleError } from '../error-handler.js';
import { EXIT } from '../exit-codes.js';
import { makeLogger } from '../stderr.js';

interface GlobalOpts {
  db?: string;
  quiet?: boolean;
  debug?: boolean;
  noColor?: boolean;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileSize(path: string): Promise<number | null> {
  try {
    return (await fs.stat(path)).size;
  } catch {
    return null;
  }
}

export function updateCommand(): Command {
  return new Command('update')
    .description('Download fresh iptoasn TSV and optimize for search into db.bin')
    .option('--force', 'overwrite existing db without checks')
    .action(async (opts: { force?: boolean }, command: Command) => {
      const global = command.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger({
        quiet: global.quiet ?? false,
        debug: global.debug ?? false,
        color: !(global.noColor ?? false),
      });
      try {
        logger.info(`downloading ${IPTOASN_URL} ...`);
        const result = await updateDatabase({ force: opts.force ?? true });
        const tsvBytes = await fileSize(result.tsvPath);

        logger.info(`data directory: ${result.dataDir}`);
        const tsvSize = tsvBytes !== null ? ` (${formatBytes(tsvBytes)})` : '';
        logger.info(`  TSV (downloaded): ${result.tsvPath}${tsvSize}`);
        logger.info(
          `  DB  (search-optimized): ${result.dbPath} (${formatBytes(result.bytesWritten)})`,
        );
        logger.info(`indexed ${result.rangeCount} ranges, ${result.asnCount} ASNs`);
        process.exit(EXIT.ok);
      } catch (e) {
        process.exit(handleError(e, logger, global.debug ?? false));
      }
    });
}
