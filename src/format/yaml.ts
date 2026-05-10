import { stringify } from 'yaml';
import type { FormattableInput } from '../types/domain.js';

export function formatYaml(input: FormattableInput): string {
  return stringify(input, {
    indent: 2,
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  });
}
