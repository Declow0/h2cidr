import { describe, expect, it } from 'vitest';
import { resolveOutput } from '../format-resolver.js';

describe('resolveOutput', () => {
  it('uses format flag when provided', () => {
    expect(resolveOutput({ format: 'json', output: 'out.txt' })).toEqual({
      format: 'json',
      path: 'out.txt',
    });
  });

  it('infers format from extension when format not given', () => {
    expect(resolveOutput({ format: undefined, output: 'out.bat' })).toEqual({
      format: 'keenetic',
      path: 'out.bat',
    });
    expect(resolveOutput({ format: undefined, output: 'r.csv' })).toEqual({
      format: 'csv',
      path: 'r.csv',
    });
    expect(resolveOutput({ format: undefined, output: 'd.yaml' })).toEqual({
      format: 'yaml',
      path: 'd.yaml',
    });
    expect(resolveOutput({ format: undefined, output: 'd.json' })).toEqual({
      format: 'json',
      path: 'd.json',
    });
    expect(resolveOutput({ format: undefined, output: 'r.md' })).toEqual({
      format: 'md',
      path: 'r.md',
    });
    expect(resolveOutput({ format: undefined, output: 't.txt' })).toEqual({
      format: 'table',
      path: 't.txt',
    });
  });

  it('appends extension when -o has none and format is explicit', () => {
    expect(resolveOutput({ format: 'csv', output: 'out' })).toEqual({
      format: 'csv',
      path: 'out.csv',
    });
    expect(resolveOutput({ format: 'keenetic', output: 'routes' })).toEqual({
      format: 'keenetic',
      path: 'routes.bat',
    });
    expect(resolveOutput({ format: 'md', output: 'report' })).toEqual({
      format: 'md',
      path: 'report.md',
    });
  });

  it('appends default extension when -o has none and format not given', () => {
    expect(resolveOutput({ format: undefined, output: 'out' })).toEqual({
      format: 'table',
      path: 'out.txt',
    });
  });

  it('default format is table when no format and no output', () => {
    expect(resolveOutput({ format: undefined, output: undefined })).toEqual({
      format: 'table',
      path: undefined,
    });
  });

  it('keeps mismatched extension when both format and output specified', () => {
    expect(resolveOutput({ format: 'json', output: 'thing.csv' })).toEqual({
      format: 'json',
      path: 'thing.csv',
    });
  });

  it('falls back to default format when extension is unknown', () => {
    expect(resolveOutput({ format: undefined, output: 'thing.weird' })).toEqual({
      format: 'table',
      path: 'thing.weird',
    });
  });
});
