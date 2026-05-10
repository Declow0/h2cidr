import { promises as fs } from 'node:fs';
import { Command, Option } from 'commander';
import { openDatabase } from '../../db/index.js';
import { type FormatName, format } from '../../format/index.js';
import {
  CrtShProvider,
  SUBFINDER_DOWNLOAD_URL,
  type SubdomainProvider,
  SubfinderProvider,
  resolveSubfinderExec,
} from '../../resolver/index.js';
import { asFqdn, asIpv4 } from '../../types/brand.js';
import type { FormattableInput } from '../../types/domain.js';
import type { ProgressEvent } from '../../types/progress.js';
import { handleError } from '../error-handler.js';
import { EXIT } from '../exit-codes.js';
import { resolveOutput } from '../format-resolver.js';
import { type StderrLogger, makeLogger } from '../stderr.js';

interface GlobalOpts {
  db?: string;
  quiet?: boolean;
  debug?: boolean;
  noColor?: boolean;
}

interface LookupOpts {
  format?: FormatName;
  output?: string;
  recursive?: boolean;
  timeout?: string;
  crtsh?: boolean | string;
  subfinder?: boolean;
  dnsConcurrency?: string;
  gateway?: string;
  annotate?: boolean;
  eol?: 'lf' | 'crlf';
}

const HELP_AFTER = `
Subfinder setup:
  Download a release for your OS from
    ${SUBFINDER_DOWNLOAD_URL}
  Then either:
    - place the binary in PATH so 'subfinder' (or 'subfinder.exe' on Windows) is callable, or
    - set SUBFINDER_EXEC to either:
        * the full path to the binary, e.g.  C:\\Tools\\subfinder.exe
        * a directory containing the binary, e.g.  C:\\Tools

Examples:
  h2cidr lookup api.github.com
  h2cidr lookup example.com -r -C           # recursive + crt.sh, 3 attempts (default)
  h2cidr lookup example.com -r -C 1 -S      # both providers, 1 crt.sh attempt (no retry)
  h2cidr lookup example.com -r -C -o out    # writes out.txt (table, no color)
  h2cidr lookup example.com -r -C -f md -o report
`;

const DEFAULT_CRTSH_ATTEMPTS = 3;

function parseAttempts(raw: boolean | string): number | null {
  if (raw === true) return DEFAULT_CRTSH_ATTEMPTS;
  if (typeof raw !== 'string') return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function backoffDelays(retries: number): number[] {
  const delays: number[] = [];
  for (let i = 0; i < retries; i++) delays.push(1000 * 2 ** i);
  return delays;
}

function makeProgressHandler(logger: StderrLogger): (e: ProgressEvent) => void {
  let lastResolveLog = 0;
  return (e) => {
    switch (e.kind) {
      case 'enumerate-start':
        if (e.providers.length > 0) {
          logger.info(`enumerating subdomains via: ${e.providers.join(', ')}`);
        }
        break;
      case 'provider-start':
        logger.info(`  ${e.provider}: querying ...`);
        break;
      case 'provider-end':
        logger.info(
          `  ${e.provider}: returned ${e.count} FQDN(s) in ${(e.durationMs / 1000).toFixed(1)}s`,
        );
        break;
      case 'provider-error':
        logger.error(
          `  ${e.provider}: failed in ${(e.durationMs / 1000).toFixed(1)}s — ${e.message}`,
        );
        break;
      case 'resolve-start':
        logger.info(`resolving ${e.total} FQDN(s) ...`);
        lastResolveLog = 0;
        break;
      case 'resolve-progress': {
        const done = e.resolved + e.failed;
        if (done - lastResolveLog >= 10 || done === e.total) {
          logger.info(`  resolved ${done}/${e.total} (failed: ${e.failed})`);
          lastResolveLog = done;
        }
        break;
      }
      case 'resolve-end':
        logger.info(`resolved ${e.resolved}, unresolved ${e.failed}`);
        break;
    }
  };
}

export function lookupCommand(): Command {
  return new Command('lookup')
    .description('FQDN → CIDR list. With -r/--recursive, enumerate subdomains first.')
    .argument('<fqdn>', 'fully qualified domain name to look up')
    .option('-f, --format <name>', 'output format: csv, json, yaml, keenetic, md, table (default)')
    .option(
      '-o, --output <file>',
      'write to file (extension auto-added when missing; implies --no-color for table)',
    )
    .option(
      '-r, --recursive',
      'enumerate subdomains via providers, resolve in bulk, group by CIDR (requires -C and/or -S)',
    )
    .option(
      '-C, --crtsh [attempts]',
      'recursive: enable crt.sh; optional N attempts (default 3) — crt.sh is flaky, N>1 retries 4xx/5xx/timeouts with exponential backoff (1s, 2s, 4s, ...)',
    )
    .option('-S, --subfinder', 'recursive: enable subfinder provider (requires binary, see below)')
    .option('-t, --timeout <ms>', 'recursive: per-provider timeout in ms', '60000')
    .option('--dns-concurrency <n>', 'recursive: parallel DNS resolutions', '20')
    .option('--gateway <ip>', 'keenetic: gateway IP for static routes')
    .option('--annotate', 'keenetic: annotate output with ASN/FQDN comments')
    .addOption(
      new Option('--eol <eol>', 'keenetic: line ending (default crlf — Windows .bat)').choices([
        'lf',
        'crlf',
      ]),
    )
    .addHelpText('after', HELP_AFTER)
    .action(async (fqdn: string, cmdOpts: LookupOpts, command: Command) => {
      const global = command.optsWithGlobals<GlobalOpts>();
      const logger = makeLogger({
        quiet: global.quiet ?? false,
        debug: global.debug ?? false,
        color: !(global.noColor ?? false),
      });
      if (cmdOpts.recursive && !cmdOpts.crtsh && !cmdOpts.subfinder) {
        logger.error('-r/--recursive requires at least one provider: -C/--crtsh or -S/--subfinder');
        process.exit(EXIT.badArgs);
      }
      try {
        const db = openDatabase(global.db ? { path: global.db } : {});

        const { format: fmt, path } = resolveOutput({
          format: cmdOpts.format,
          output: cmdOpts.output,
        });
        const colorEnabled =
          path === undefined && !(global.noColor ?? false) && (process.stdout.isTTY ?? false);

        if (cmdOpts.recursive) {
          await runRecursive(db, fqdn, cmdOpts, fmt, path, colorEnabled, logger);
        } else {
          await runSingle(db, fqdn, cmdOpts, fmt, path, colorEnabled, logger);
        }
        process.exit(EXIT.ok);
      } catch (e) {
        const code = handleError(e, logger, global.debug ?? false);
        process.exit(code);
      }
    });
}

async function runSingle(
  db: ReturnType<typeof openDatabase>,
  fqdn: string,
  cmdOpts: LookupOpts,
  fmt: FormatName,
  path: string | undefined,
  color: boolean,
  logger: StderrLogger,
): Promise<void> {
  const result = await db.lookupFqdn(asFqdn(fqdn));
  const text = render(fmt, result, cmdOpts, color);
  if (path) {
    await fs.writeFile(path, text);
    logger.info(`wrote ${result.matches.length} matches to ${path} (${fmt})`);
  } else {
    process.stdout.write(text);
  }
}

async function runRecursive(
  db: ReturnType<typeof openDatabase>,
  fqdn: string,
  cmdOpts: LookupOpts,
  fmt: FormatName,
  path: string | undefined,
  color: boolean,
  logger: StderrLogger,
): Promise<void> {
  const providers: SubdomainProvider[] = [];
  if (cmdOpts.crtsh) {
    const attempts = parseAttempts(cmdOpts.crtsh);
    if (attempts === null) {
      logger.error(
        `invalid -C/--crtsh value: ${String(cmdOpts.crtsh)} (expected positive integer)`,
      );
      process.exit(EXIT.badArgs);
    }
    providers.push(new CrtShProvider({ retryDelaysMs: backoffDelays(attempts - 1) }));
  }
  if (cmdOpts.subfinder) {
    const r = await resolveSubfinderExec();
    if (!r.ok) {
      logger.error(`subfinder not available: ${r.reason}`);
      logger.error(`Download a release for your OS from: ${SUBFINDER_DOWNLOAD_URL}`);
      logger.error('Then set SUBFINDER_EXEC to the binary path or its containing directory,');
      logger.error('or place the binary in PATH.');
      process.exit(EXIT.badArgs);
    }
    providers.push(new SubfinderProvider(r.execPath));
    logger.info(`subfinder: ${r.execPath}`);
  }

  logger.info(`${fqdn} → providers: ${providers.map((p) => p.name).join(', ')}`);

  const result = await db.lookupDomain(asFqdn(fqdn), {
    providers,
    dnsConcurrency: Number(cmdOpts.dnsConcurrency ?? '20'),
    timeoutMs: Number(cmdOpts.timeout ?? '60000'),
    onProgress: makeProgressHandler(logger),
  });

  if (result.errors.length > 0) {
    logger.error(`${result.errors.length} provider(s) failed:`);
    for (const e of result.errors) {
      logger.error(`  ${e.source}: ${e.message}`);
    }
  }

  if (result.groups.length === 0) {
    logger.error('no CIDR matches found');
    process.exit(EXIT.noResults);
  }

  const text = render(fmt, result, cmdOpts, color);
  if (path) {
    await fs.writeFile(path, text);
    logger.info(`wrote ${result.groups.length} groups to ${path} (${fmt})`);
  } else {
    process.stdout.write(text);
  }
}

function render(
  fmt: FormatName,
  input: FormattableInput,
  cmdOpts: LookupOpts,
  color: boolean,
): string {
  switch (fmt) {
    case 'keenetic':
      return format.keenetic(input, {
        ...(cmdOpts.gateway ? { gateway: asIpv4(cmdOpts.gateway) } : {}),
        annotate: cmdOpts.annotate ?? false,
        eol: cmdOpts.eol ?? 'crlf',
      });
    case 'csv':
      return format.csv(input);
    case 'json':
      return format.json(input);
    case 'yaml':
      return format.yaml(input);
    case 'md':
      return format.md(input);
    case 'table':
      return format.table(input, { color });
  }
}
