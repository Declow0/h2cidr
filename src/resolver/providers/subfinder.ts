import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { ProviderError } from '../../errors.js';
import { type Fqdn, asFqdn } from '../../types/brand.js';
import type { ProviderEnumerateOptions, SubdomainProvider } from './types.js';

const SUBFINDER_BINARY_NAME = process.platform === 'win32' ? 'subfinder.exe' : 'subfinder';
export const SUBFINDER_DOWNLOAD_URL = 'https://github.com/projectdiscovery/subfinder/releases';

function execFilePromise(
  exe: string,
  args: string[],
  opts: { signal?: AbortSignal; timeout?: number; maxBuffer?: number; windowsHide?: boolean },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const cp = execFile(exe, args, { ...opts, encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) {
        const e = err as Error & { stderr?: string };
        e.stderr = stderr as string;
        reject(e);
      } else resolve({ stdout: stdout as string, stderr: stderr as string });
    });
    // subfinder ≥ v2.14 on Windows reads stdin even with -d and hangs forever
    // when stdin is a pipe (Node's default). Close it explicitly.
    cp.stdin?.end();
  });
}

type SubfinderResolution = { ok: true; execPath: string } | { ok: false; reason: string };

export interface ResolveSubfinderDeps {
  envExec: string | undefined;
  stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean } | null>;
  canExecute(path: string): Promise<{ ok: true } | { ok: false; reason: string }>;
  binaryName: string;
}

export async function resolveSubfinderExecImpl(
  deps: ResolveSubfinderDeps,
): Promise<SubfinderResolution> {
  const env = deps.envExec;
  if (env && env.length > 0) {
    const stat = await deps.stat(env);
    if (!stat) {
      return {
        ok: false,
        reason: `SUBFINDER_EXEC points to non-existent path: ${env}`,
      };
    }
    let candidate = env;
    if (stat.isDirectory()) {
      candidate = join(env, deps.binaryName);
      const fileStat = await deps.stat(candidate);
      if (!fileStat || !fileStat.isFile()) {
        return {
          ok: false,
          reason: `${deps.binaryName} not found inside SUBFINDER_EXEC directory ${env}`,
        };
      }
    } else if (!stat.isFile()) {
      return {
        ok: false,
        reason: `SUBFINDER_EXEC is neither a file nor a directory: ${env}`,
      };
    }
    const verified = await deps.canExecute(candidate);
    if (!verified.ok) {
      return { ok: false, reason: `cannot execute ${candidate}: ${verified.reason}` };
    }
    return { ok: true, execPath: candidate };
  }

  // No env var — try the binary name from PATH
  const verified = await deps.canExecute(deps.binaryName);
  if (!verified.ok) {
    return {
      ok: false,
      reason: 'subfinder not found in PATH and SUBFINDER_EXEC is not set',
    };
  }
  return { ok: true, execPath: deps.binaryName };
}

async function defaultStat(
  path: string,
): Promise<{ isDirectory(): boolean; isFile(): boolean } | null> {
  try {
    return await fs.stat(path);
  } catch {
    return null;
  }
}

async function defaultCanExecute(
  execPath: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await execFilePromise(execPath, ['-version'], {
      timeout: 5000,
      windowsHide: true,
    });
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { code?: string | number; message?: string };
    return { ok: false, reason: err.message ?? String(e) };
  }
}

export function resolveSubfinderExec(): Promise<SubfinderResolution> {
  return resolveSubfinderExecImpl({
    // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation for unknown env vars
    envExec: process.env['SUBFINDER_EXEC'],
    stat: defaultStat,
    canExecute: defaultCanExecute,
    binaryName: SUBFINDER_BINARY_NAME,
  });
}

export class SubfinderProvider implements SubdomainProvider {
  readonly name = 'subfinder';
  readonly requiresApiKey = false;

  constructor(public readonly execPath: string) {}

  async enumerate(domain: Fqdn, opts: ProviderEnumerateOptions): Promise<readonly Fqdn[]> {
    const args = ['-d', domain, '-silent'];
    const timeoutMs = opts.timeoutMs ?? 60_000;

    try {
      const { stdout } = await execFilePromise(this.execPath, args, {
        signal: opts.signal,
        timeout: timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
      });
      const out = new Set<string>();
      for (const raw of stdout.split(/\r?\n/)) {
        const trimmed = raw.trim().toLowerCase();
        if (trimmed.length === 0) continue;
        try {
          const fqdn = asFqdn(trimmed);
          out.add(fqdn);
        } catch {
          // invalid — skip
        }
      }
      return [...out] as Fqdn[];
    } catch (e: unknown) {
      const err = e as { message?: string; stderr?: string };
      const headline = err.message ?? String(e);
      const detail = err.stderr?.trim();
      throw new ProviderError(this.name, detail ? `${headline} — ${detail}` : headline);
    }
  }
}
