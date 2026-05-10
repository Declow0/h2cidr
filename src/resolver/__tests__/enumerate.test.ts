import { describe, expect, it } from 'vitest';
import { type Fqdn, asFqdn } from '../../types/brand.js';
import type { ProgressEvent } from '../../types/progress.js';
import { enumerateSubdomains } from '../enumerate.js';
import type { SubdomainProvider } from '../providers/types.js';

class StubProvider implements SubdomainProvider {
  readonly requiresApiKey = false;
  constructor(
    public readonly name: string,
    private readonly out: string[] | Error,
  ) {}
  async enumerate(): Promise<readonly Fqdn[]> {
    if (this.out instanceof Error) throw this.out;
    return this.out.map((s) => asFqdn(s));
  }
}

describe('enumerateSubdomains', () => {
  it('unions provider results, includes apex, filters out-of-domain', async () => {
    const p1 = new StubProvider('a', ['api.example.com', 'cdn.example.com', 'evil.com']);
    const p2 = new StubProvider('b', ['cdn.example.com', 'mail.example.com']);
    const r = await enumerateSubdomains(asFqdn('example.com'), { providers: [p1, p2] });
    expect(new Set(r.fqdns)).toEqual(
      new Set(['example.com', 'api.example.com', 'cdn.example.com', 'mail.example.com']),
    );
    expect(r.providersUsed).toEqual(['a', 'b']);
    expect(r.errors).toHaveLength(0);
  });

  it('records errors but keeps other providers', async () => {
    const p1 = new StubProvider('ok', ['api.example.com']);
    const p2 = new StubProvider('bad', new Error('boom'));
    const r = await enumerateSubdomains(asFqdn('example.com'), { providers: [p1, p2] });
    expect(r.errors).toEqual([{ source: 'bad', message: 'boom' }]);
    expect(new Set(r.fqdns)).toEqual(new Set(['example.com', 'api.example.com']));
    expect(r.providersUsed).toEqual(['ok']);
  });

  it('emits progress events for start/end/error', async () => {
    const p1 = new StubProvider('ok', ['api.example.com']);
    const p2 = new StubProvider('bad', new Error('boom'));
    const events: ProgressEvent[] = [];
    await enumerateSubdomains(asFqdn('example.com'), {
      providers: [p1, p2],
      onProgress: (e) => events.push(e),
    });
    const kinds = events.map((e) => e.kind);
    expect(kinds[0]).toBe('enumerate-start');
    expect(kinds).toContain('provider-start');
    expect(kinds).toContain('provider-end');
    expect(kinds).toContain('provider-error');
    const errEvent = events.find((e) => e.kind === 'provider-error');
    if (errEvent && errEvent.kind === 'provider-error') {
      expect(errEvent.provider).toBe('bad');
      expect(errEvent.message).toBe('boom');
      expect(errEvent.durationMs).toBeGreaterThanOrEqual(0);
    } else {
      throw new Error('expected provider-error event');
    }
    const okEvent = events.find((e) => e.kind === 'provider-end');
    if (okEvent && okEvent.kind === 'provider-end') {
      expect(okEvent.provider).toBe('ok');
      expect(okEvent.count).toBe(1);
    } else {
      throw new Error('expected provider-end event');
    }
  });
});
