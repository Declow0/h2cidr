import {
  CompactionError,
  DbNotFoundError,
  DnsResolutionError,
  HostnameToCidrError,
  InvalidFqdnError,
  InvalidIpError,
  NetworkError,
  ProviderError,
} from '../errors.js';
import { EXIT, type ExitCode } from './exit-codes.js';
import type { StderrLogger } from './stderr.js';

export function handleError(e: unknown, logger: StderrLogger, debug: boolean): ExitCode {
  if (e instanceof DbNotFoundError) {
    logger.error(e.message);
    return EXIT.dbMissing;
  }
  if (e instanceof NetworkError) {
    logger.error(e.message);
    return EXIT.network;
  }
  if (
    e instanceof InvalidFqdnError ||
    e instanceof InvalidIpError ||
    e instanceof DnsResolutionError ||
    e instanceof CompactionError ||
    e instanceof ProviderError
  ) {
    logger.error(e.message);
    if (debug && e.stack) logger.debug(e.stack);
    return EXIT.general;
  }
  if (e instanceof HostnameToCidrError) {
    logger.error(`${e.code}: ${e.message}`);
    return EXIT.general;
  }
  if (e instanceof Error) {
    logger.error(e.message);
    if (debug && e.stack) logger.debug(e.stack);
    return EXIT.general;
  }
  logger.error(String(e));
  return EXIT.general;
}
