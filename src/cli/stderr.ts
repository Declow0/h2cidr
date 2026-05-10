import pc from 'picocolors';

export interface StderrLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
}

interface ColorAdapter {
  yellow(s: string): string;
  red(s: string): string;
  dim(s: string): string;
}

const noColor: ColorAdapter = {
  yellow: (s) => s,
  red: (s) => s,
  dim: (s) => s,
};

export function makeLogger(opts: { quiet: boolean; debug: boolean; color: boolean }): StderrLogger {
  const c: ColorAdapter = opts.color ? pc : noColor;
  return {
    info(msg) {
      if (!opts.quiet) process.stderr.write(`${msg}\n`);
    },
    warn(msg) {
      if (!opts.quiet) process.stderr.write(`${c.yellow('warn:')} ${msg}\n`);
    },
    error(msg) {
      process.stderr.write(`${c.red('error:')} ${msg}\n`);
    },
    debug(msg) {
      if (opts.debug) process.stderr.write(`${c.dim('debug:')} ${msg}\n`);
    },
  };
}
