export const EXIT = {
  ok: 0,
  general: 1,
  badArgs: 2,
  dbMissing: 3,
  noResults: 4,
  network: 5,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
