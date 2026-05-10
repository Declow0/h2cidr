import type { FormattableInput } from '../types/domain.js';

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function formatJson(input: FormattableInput): string {
  return `${JSON.stringify(input, jsonReplacer, 2)}\n`;
}
