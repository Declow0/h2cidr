import { afterEach, describe, expect, it, vi } from 'vitest';
import { asFqdn } from '../../../types/brand.js';
import { CrtShProvider } from '../crtsh.js';

afterEach(() => vi.unstubAllGlobals());

describe('CrtShProvider', () => {
  it('parses crt.sh response', async () => {
    const payload = [
      // biome-ignore lint/style/useNamingConvention: name_value is the crt.sh JSON API field name
      { name_value: 'api.example.com\nwww.example.com' },
      // biome-ignore lint/style/useNamingConvention: name_value is the crt.sh JSON API field name
      { name_value: '*.example.com' },
      // biome-ignore lint/style/useNamingConvention: name_value is the crt.sh JSON API field name
      { name_value: 'mail.example.com' },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    );
    const p = new CrtShProvider({ retryDelaysMs: [] });
    const fqdns = await p.enumerate(asFqdn('example.com'), {
      signal: new AbortController().signal,
    });
    expect(new Set(fqdns)).toEqual(
      new Set(['api.example.com', 'www.example.com', 'mail.example.com']),
    );
  });

  it('uses wildcard recursive query', async () => {
    const fetchSpy = vi.fn(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const p = new CrtShProvider({ retryDelaysMs: [] });
    await p.enumerate(asFqdn('example.com'), { signal: new AbortController().signal });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('q=%25.example.com'),
      expect.any(Object),
    );
  });

  it('throws ProviderError after exhausting retries on transient HTTP failure', async () => {
    const fetchSpy = vi.fn(async () => new Response('boom', { status: 504 }));
    vi.stubGlobal('fetch', fetchSpy);
    const p = new CrtShProvider({ retryDelaysMs: [0, 0] });
    await expect(
      p.enumerate(asFqdn('example.com'), { signal: new AbortController().signal }),
    ).rejects.toThrow(/crtsh/);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('retries once then succeeds on transient failure', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 502 }))
      .mockResolvedValueOnce(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const p = new CrtShProvider({ retryDelaysMs: [0] });
    const fqdns = await p.enumerate(asFqdn('example.com'), {
      signal: new AbortController().signal,
    });
    expect(fqdns).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('respects abort signal', async () => {
    const ac = new AbortController();
    ac.abort();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init?: RequestInit) => {
        if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
        return new Response('[]');
      }),
    );
    const p = new CrtShProvider({ retryDelaysMs: [] });
    await expect(p.enumerate(asFqdn('example.com'), { signal: ac.signal })).rejects.toThrow();
  });
});
