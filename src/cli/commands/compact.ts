import { Command } from 'commander';
import { compactTsv } from '../../db/index.js';
import { handleError } from '../error-handler.js';
import { EXIT } from '../exit-codes.js';
import { makeLogger } from '../stderr.js';

interface GlobalOpts {
  quiet?: boolean;
  debug?: boolean;
  noColor?: boolean;
}

function defaultDest(src: string): string {
  if (src.endsWith('.tsv.gz')) return src.replace(/\.tsv\.gz$/, '.bin');
  if (src.endsWith('.tsv')) return src.replace(/\.tsv$/, '.bin');
  return `${src}.bin`;
}

export function compactCommand(): Command {
  return new Command('compact')
    .description('Convert iptoasn TSV (.tsv or .tsv.gz) to compact .bin')
    .argument('<src>')
    .argument('[dst]')
    .option('--force', 'overwrite if destination exists')
    .action(
      async (src: string, dst: string | undefined, opts: { force?: boolean }, command: Command) => {
        const global = command.optsWithGlobals<GlobalOpts>();
        const logger = makeLogger({
          quiet: global.quiet ?? false,
          debug: global.debug ?? false,
          color: !(global.noColor ?? false),
        });
        try {
          const dstPath = dst ?? defaultDest(src);
          const result = await compactTsv({ srcPath: src, dstPath, force: opts.force ?? false });
          logger.info(
            `wrote ${result.rangeCount} ranges (${result.bytesWritten} bytes) to ${dstPath}`,
          );
          process.exit(EXIT.ok);
        } catch (e) {
          process.exit(handleError(e, logger, global.debug ?? false));
        }
      },
    );
}
