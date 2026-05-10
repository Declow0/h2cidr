import type { FormatName } from '../format/index.js';

const EXT_TO_FORMAT: Record<string, FormatName> = {
  '.csv': 'csv',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.bat': 'keenetic',
  '.md': 'md',
  '.markdown': 'md',
  '.txt': 'table',
};

const FORMAT_TO_EXT: Record<FormatName, string> = {
  csv: '.csv',
  json: '.json',
  yaml: '.yaml',
  keenetic: '.bat',
  md: '.md',
  table: '.txt',
};

const DEFAULT_FORMAT: FormatName = 'table';

export interface ResolveOutputInput {
  format: FormatName | undefined;
  output: string | undefined;
}

export interface ResolvedOutput {
  format: FormatName;
  path: string | undefined;
}

function getExt(p: string): string {
  const dot = p.lastIndexOf('.');
  if (dot < 0) return '';
  const slash = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  if (dot < slash) return '';
  return p.slice(dot).toLowerCase();
}

export function resolveOutput(input: ResolveOutputInput): ResolvedOutput {
  // No output path — format is either explicit or the default.
  if (!input.output) {
    return { format: input.format ?? DEFAULT_FORMAT, path: undefined };
  }

  const ext = getExt(input.output);

  if (input.format) {
    // Format is explicitly specified. If the path has no extension, append one.
    // If it already has an extension (even a mismatched one), keep as-is —
    // explicit user intent wins.
    if (ext.length === 0) {
      return { format: input.format, path: input.output + FORMAT_TO_EXT[input.format] };
    }
    return { format: input.format, path: input.output };
  }

  // No format specified — infer from extension if recognised, otherwise use the
  // default and append its extension so the file ends up with a sensible suffix.
  const inferred = EXT_TO_FORMAT[ext];
  if (inferred) return { format: inferred, path: input.output };
  if (ext.length === 0) {
    return { format: DEFAULT_FORMAT, path: input.output + FORMAT_TO_EXT[DEFAULT_FORMAT] };
  }
  return { format: DEFAULT_FORMAT, path: input.output };
}
