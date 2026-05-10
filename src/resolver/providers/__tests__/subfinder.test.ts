import * as childProcess from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { asFqdn } from '../../../types/brand.js';
import {
  type ResolveSubfinderDeps,
  SubfinderProvider,
  resolveSubfinderExecImpl,
} from '../subfinder.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function mockExecFileSuccess(stdout: string) {
  (childProcess.execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      cb(null, stdout, '');
      return {} as never;
    },
  );
}

function mockExecFileFailure(error: Error) {
  (childProcess.execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      cb(error, '', error.message);
      return {} as never;
    },
  );
}

describe('SubfinderProvider', () => {
  it('parses subfinder stdout (one FQDN per line)', async () => {
    mockExecFileSuccess('api.example.com\nwww.example.com\ncdn.example.com\n');
    const p = new SubfinderProvider('/opt/subfinder/subfinder');
    const fqdns = await p.enumerate(asFqdn('example.com'), {
      signal: new AbortController().signal,
    });
    expect(new Set(fqdns)).toEqual(
      new Set(['api.example.com', 'www.example.com', 'cdn.example.com']),
    );
  });

  it('skips invalid lines and dedupes', async () => {
    mockExecFileSuccess('api.example.com\n\nINVALID\napi.example.com\nwww.example.com\n');
    const p = new SubfinderProvider('/opt/subfinder/subfinder');
    const fqdns = await p.enumerate(asFqdn('example.com'), {
      signal: new AbortController().signal,
    });
    expect(new Set(fqdns)).toEqual(new Set(['api.example.com', 'www.example.com']));
  });

  it('uses execPath provided to constructor', async () => {
    let capturedCmd = '';
    (childProcess.execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (
        cmd: string,
        _args: string[],
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        capturedCmd = cmd;
        cb(null, '', '');
        return {} as never;
      },
    );
    const p = new SubfinderProvider('/custom/path/subfinder');
    await p.enumerate(asFqdn('example.com'), { signal: new AbortController().signal });
    expect(capturedCmd).toBe('/custom/path/subfinder');
  });

  it('throws ProviderError on non-zero exit', async () => {
    const exit = Object.assign(new Error('exit 1'), { code: 1 });
    mockExecFileFailure(exit);
    const p = new SubfinderProvider('/opt/subfinder/subfinder');
    await expect(
      p.enumerate(asFqdn('example.com'), { signal: new AbortController().signal }),
    ).rejects.toThrow(/subfinder/);
  });
});

describe('resolveSubfinderExecImpl', () => {
  function makeDeps(overrides: Partial<ResolveSubfinderDeps> = {}): ResolveSubfinderDeps {
    return {
      envExec: undefined,
      stat: vi.fn().mockResolvedValue(null),
      canExecute: vi.fn().mockResolvedValue({ ok: true }),
      binaryName: 'subfinder.exe',
      ...overrides,
    };
  }

  it('falls back to PATH when SUBFINDER_EXEC is unset', async () => {
    const canExecute = vi.fn().mockResolvedValue({ ok: true });
    const r = await resolveSubfinderExecImpl(makeDeps({ envExec: undefined, canExecute }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.execPath).toBe('subfinder.exe');
    expect(canExecute).toHaveBeenCalledWith('subfinder.exe');
  });

  it('fails when SUBFINDER_EXEC unset and PATH binary missing', async () => {
    const canExecute = vi.fn().mockResolvedValue({ ok: false, reason: 'ENOENT' });
    const r = await resolveSubfinderExecImpl(makeDeps({ envExec: undefined, canExecute }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not found in PATH/);
  });

  it('uses SUBFINDER_EXEC pointing to a file', async () => {
    const stat = vi.fn().mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    const canExecute = vi.fn().mockResolvedValue({ ok: true });
    const r = await resolveSubfinderExecImpl(
      makeDeps({ envExec: '/custom/subfinder', stat, canExecute }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.execPath).toBe('/custom/subfinder');
    expect(canExecute).toHaveBeenCalledWith('/custom/subfinder');
  });

  it('uses SUBFINDER_EXEC pointing to a directory', async () => {
    const stat = vi
      .fn()
      .mockImplementationOnce(async () => ({ isDirectory: () => true, isFile: () => false }))
      .mockImplementationOnce(async () => ({ isDirectory: () => false, isFile: () => true }));
    const canExecute = vi.fn().mockResolvedValue({ ok: true });
    const r = await resolveSubfinderExecImpl(
      makeDeps({ envExec: '/opt/bin', stat, canExecute, binaryName: 'subfinder.exe' }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.execPath).toMatch(/[\\/]opt[\\/]bin[\\/]subfinder\.exe$/);
  });

  it('fails when SUBFINDER_EXEC points to non-existent path', async () => {
    const stat = vi.fn().mockResolvedValue(null);
    const r = await resolveSubfinderExecImpl(makeDeps({ envExec: '/missing', stat }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/non-existent/);
  });

  it('fails when SUBFINDER_EXEC dir does not contain binary', async () => {
    const stat = vi
      .fn()
      .mockImplementationOnce(async () => ({ isDirectory: () => true, isFile: () => false }))
      .mockImplementationOnce(async () => null);
    const r = await resolveSubfinderExecImpl(
      makeDeps({ envExec: '/opt/wrong', stat, binaryName: 'subfinder.exe' }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not found inside SUBFINDER_EXEC directory/);
  });

  it('fails when binary cannot execute', async () => {
    const stat = vi.fn().mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    const canExecute = vi.fn().mockResolvedValue({ ok: false, reason: 'permission denied' });
    const r = await resolveSubfinderExecImpl(
      makeDeps({ envExec: '/opt/subfinder', stat, canExecute }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/cannot execute.*permission denied/);
  });
});
