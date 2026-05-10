#!/usr/bin/env node
import { Command, type CommanderError } from 'commander';
import { compactCommand } from './cli/commands/compact.js';
import { lookupCommand } from './cli/commands/lookup.js';
import { updateCommand } from './cli/commands/update.js';

const HELP_OK_CODES = new Set(['commander.help', 'commander.helpDisplayed', 'commander.version']);

function withHelpOnError(cmd: Command): Command {
  cmd.exitOverride((err: CommanderError) => {
    if (!HELP_OK_CODES.has(err.code)) {
      cmd.outputHelp({ error: true });
    }
    process.exit(err.exitCode);
  });
  return cmd;
}

const program = new Command()
  .name('h2cidr')
  .description('Map hostname/domain to ASN CIDR ranges via iptoasn')
  .version('0.1.0', '-v, --version', 'output the version number')
  .option('--db <path>', 'path to search-optimized db.bin')
  .option('--no-color', 'disable ANSI colors')
  .option('--quiet', 'suppress progress on stderr')
  .option('--debug', 'verbose error output');

withHelpOnError(program);
program.addCommand(withHelpOnError(lookupCommand()));
program.addCommand(withHelpOnError(updateCommand()));
// compact stays callable (used by smoke tests + scripted workflows) but is
// hidden from --help to keep the user-facing surface small.
program.addCommand(withHelpOnError(compactCommand()), { hidden: true });

program.parseAsync(process.argv).catch((e: unknown) => {
  // exitOverride already handled known commander errors (help printed, exit
  // code set). Anything reaching here is unexpected.
  process.stderr.write(`fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
