# CLAUDE.md

Guidance for Claude Code working in this repo.

## Stack

TypeScript strict + ESM, Node ≥ 24, plain npm (no workspaces). Toolchain: Biome, Knip, Vitest. The package is the CLI `h2cidr`; modules under `src/` exist only to support it (no library entry).

## Commands

```pwsh
npm install
npm run build           # tsc → dist/
npm test                # smoke test depends on dist/, so build first
npm run lint            # biome check
npm run knip            # unused exports/deps
npm run dev -- lookup api.github.com
```

No CI, no pre-commit hook by design — verify locally with `npm test && npm run lint && npm run knip` before committing.

## Architecture

CLI surface: `lookup <fqdn>` (and hidden `compact`, public `update`). Both `lookup` paths funnel into `lookupIpInBuffer(loadedDb, ip)` — a binary search over a custom binary `db.bin`.

- **single (`lookup <fqdn>`)** — `src/lookup/fqdn.ts`: resolve A records → per-IP binary search → group by `RangeMatch`.
- **recursive (`lookup <fqdn> -r` with `-C` and/or `-S`)** — `src/lookup/domain.ts`: enumerate via providers in parallel (`Promise.allSettled`, apex always included), bulk DNS with `pLimit` (default 20), same CIDR lookup. Provider failures land in `result.errors`, not `result.providers`. **CLI rejects `-r` without any provider; the library layer doesn't enforce that.**

Progress events flow through an `onProgress: ProgressCallback` threaded `Database.lookupDomain → enumerateSubdomains → lookupDomainImpl`. CLI prints to stderr.

## Non-obvious behavior (the "why" you can't read from code)

- **`db.bin` format** — `update` (or hidden `compact`) bakes the iptoasn TSV into a sorted-ranges binary defined in `src/db/format.ts`. We don't parse TSV at runtime: cold start <100ms for ~500K ranges via `readFileSync` + `Uint32Array` views + binary search.
- **ASN 0 is filtered** in `lookupIpInBuffer` — those ranges ("Not routed", "Private") return `null`, treated as no match.
- **CIDRs over-cover.** The decomposition uses the iptoasn-aggregated range, sometimes wider than the actual BGP prefix. Intentional: users whitelist these in a Keenetic `.bat` for VPN bypass, where over-covering is safer than under-covering. Document any change carefully.
- **Subfinder is NOT bundled.** It's an external binary called via `execFile`. There is no submodule and no WASM build (a prior WASI spike was abandoned: raw sockets / TLS / `setrlimit` aren't in WASI preview1). `SUBFINDER_EXEC` accepts a file path or directory; falls back to `subfinder` (`subfinder.exe` on Windows) in PATH; `resolveSubfinderExec()` verifies via `<exe> -version`.
- **crt.sh is flaky.** Default for `-C` (no count) is **3 attempts**; transient 4xx/5xx/timeouts retry with exponential backoff (1s, 2s, 4s, ...). At least one of `-C`/`-S` must accompany `-r`.
- **Default DB path:** `envPaths('h2cidr', { suffix: '' }).cache + '/db.bin'`.

## Conventions worth flagging

- Strict TS (see `tsconfig.json`) and Biome rules forbid `any` and `!`. Narrow `unknown` in catch with `instanceof`. ESM imports inside the package use the `.js` extension even when pointing at `.ts`.
- **Branded types** (`src/types/brand.ts`): `Ipv4`, `Cidr`, `Fqdn`, `AsNumber`. Construct only via `asIpv4` / `asFqdn` / `asCidr` / `asAsNumber`; don't bypass with `as`. `asFqdn` lowercases and strips trailing dots.
- **Errors** — typed hierarchy in `src/errors.ts`. CLI's `error-handler.ts` maps `instanceof` to exit codes from `src/cli/exit-codes.ts` (3 = db missing, 4 = no results, 5 = network). Library code throws; CLI is the only `process.exit`.

## Tests

- Unit tests live in per-module `__tests__/` dirs. Smoke tests in `test/` `execa`-spawn the built CLI (so `npm run build` must run first).
- Fixtures: `test/fixtures/`. The `iptoasn-mini.tsv` fixture is `git add -f`'d because `*.tsv` is gitignored.
- Vitest `pool: 'forks'` — tests touch process globals.

## CLI output conventions

`table` is the default `--format`. With `-o`, format is inferred from the path's extension if recognised; otherwise `--format` wins (and we append the matching extension if the path has none). When `-o` is given, table output is rendered without ANSI colors (file is not a terminal). Keenetic output starts with `@echo off` and uses CRLF by default.
