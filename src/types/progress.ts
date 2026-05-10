export type ProgressEvent =
  | { kind: 'enumerate-start'; providers: readonly string[] }
  | { kind: 'provider-start'; provider: string }
  | { kind: 'provider-end'; provider: string; count: number; durationMs: number }
  | { kind: 'provider-error'; provider: string; message: string; durationMs: number }
  | { kind: 'resolve-start'; total: number }
  | { kind: 'resolve-progress'; resolved: number; failed: number; total: number }
  | { kind: 'resolve-end'; resolved: number; failed: number };

export type ProgressCallback = (event: ProgressEvent) => void;
