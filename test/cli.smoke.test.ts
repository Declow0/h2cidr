import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const CLI = join(import.meta.dirname, '..', 'dist', 'index.js');
const FIXTURE_TSV = join(import.meta.dirname, 'fixtures', 'iptoasn-mini.tsv');

describe('CLI smoke', () => {
  let tmp: string;
  let dbPath: string;

  beforeAll(async () => {
    await fs.access(CLI);
  });

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), 'h2c-cli-'));
    dbPath = join(tmp, 'db.bin');
    await execa('node', [CLI, 'compact', FIXTURE_TSV, dbPath, '--force']);
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('--help works', async () => {
    const { stdout } = await execa('node', [CLI, '--help']);
    expect(stdout).toContain('lookup');
    expect(stdout).toContain('update');
  });

  it('compact creates db.bin', async () => {
    const stat = await fs.stat(dbPath);
    expect(stat.size).toBeGreaterThan(32);
  });

  it('exits 3 when db missing', async () => {
    const result = await execa(
      'node',
      [CLI, '--db', join(tmp, 'missing.bin'), 'lookup', 'example.com'],
      { reject: false },
    );
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('Database not found');
  });

  it('exits 2 when -r is set without -C/-S', async () => {
    const result = await execa('node', [CLI, '--db', dbPath, 'lookup', 'example.com', '-r'], {
      reject: false,
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      '-r/--recursive requires at least one provider: -C/--crtsh or -S/--subfinder',
    );
  });
});
