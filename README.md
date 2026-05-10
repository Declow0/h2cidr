# h2cidr

CLI that maps a hostname or domain to the CIDR ranges of its ASN (backed by iptoasn).

## Requirements

- Node.js 24 LTS or newer
- npm
- Access to [IPtoASN Database: IPv4 to ASN](https://iptoasn.com/data/ip2asn-v4.tsv.gz)
- _Optional_:
  - `subfinder` in `PATH` or `SUBFINDER_EXEC` env var (for richer subdomain
  coverage in recursive mode). [Releases](https://github.com/projectdiscovery/subfinder/releases)

## Install

```pwsh
git clone <repo> h2cidr
cd h2cidr
npm install
npm run build
npm install -g .
```

After this, `h2cidr` is available from any directory;

`npx h2cidr` works too.

## Usage

```pwsh
# Download and search optimize the iptoasn dataset
h2cidr update

# Look up a single FQDN
h2cidr lookup api.example.com

# Recursive mode: enumerate subdomains, then group by CIDR
# Reqired at least one of 2 providers: crt.sh or subfinder
h2cidr lookup example.com -r -C           # + crt.sh, default 3 attempts
h2cidr lookup example.com -r -C 1 -S      # + crt.sh (1 attempt) + subfinder
h2cidr lookup example.com -r -S -f keenetic -o routes
```

## Output formats (`-f` / `--format`)

| Format          | Extension | Purpose                                 |
|-----------------|-----------|-----------------------------------------|
| `table`         | `.txt`    | Colored table for interactive use       |
| `csv`           | `.csv`    | Generic machine-readable                |
| `json`          | `.json`   | Pipe into `jq`                          |
| `yaml`          | `.yaml`   | Human-readable                          |
| `md`            | `.md`     | Markdown table                          |
| `keenetic`      | `.bat`    | Keenetic `.bat` with `route add ...`     |

If `-o` has no extension, the matching one is appended automatically.

## `lookup` options for keenetic

```
h2cidr lookup <fqdn> -f keenetic
  [--gateway <ip>]   # gateway for `route add` (default 0.0.0.0)
  [--annotate]       # add `:: ASN ... FQDN ...` comments
  [--eol <lf|crlf>]  # line endings (default crlf — Windows .bat)
```

## Output example

```bash
h2cidr lookup example.com
FQDN: example.com   IPs: 104.20.23.154, 172.66.147.243
┌────────────────────┬────────────┬──────────────────────┬────┬───────┬────────────────────────────────────────────────────────────────────────┐
│ CIDR               │ ASN        │ Name                 │ CC │ Count │ FQDNs                                                                  │
├────────────────────┼────────────┼──────────────────────┼────┼───────┼────────────────────────────────────────────────────────────────────────┤
│ 104.16.0.0/14      │ 13335      │ CLOUDFLARENET        │ US │     1 │ example.com                                                            │
├────────────────────┼────────────┼──────────────────────┼────┼───────┼────────────────────────────────────────────────────────────────────────┤
│ 104.20.0.0/18      │ 13335      │ CLOUDFLARENET        │ US │     1 │ example.com                                                            │
├────────────────────┼────────────┼──────────────────────┼────┼───────┼────────────────────────────────────────────────────────────────────────┤
│ 172.66.128.0/19    │ 13335      │ CLOUDFLARENET        │ US │     1 │ example.com                                                            │
├────────────────────┼────────────┼──────────────────────┼────┼───────┼────────────────────────────────────────────────────────────────────────┤
│ 172.66.160.0/20    │ 13335      │ CLOUDFLARENET        │ US │     1 │ example.com                                                            │
├────────────────────┼────────────┼──────────────────────┼────┼───────┼────────────────────────────────────────────────────────────────────────┤
│ 172.66.176.0/23    │ 13335      │ CLOUDFLARENET        │ US │     1 │ example.com                                                            │
└────────────────────┴────────────┴──────────────────────┴────┴───────┴────────────────────────────────────────────────────────────────────────┘
```

```bash
h2cidr lookup -r -S docs.github.com
subfinder: subfinder.exe
docs.github.com → providers: subfinder
enumerating subdomains via: subfinder
  subfinder: querying ...
  subfinder: returned 1 FQDN(s) in 12.5s
resolving 1 FQDN(s) ...
  resolved 2/2 (failed: 1)
resolved 1, unresolved 1
Domain: docs.github.com   providers: subfinder   groups: 1
┌────────────────────┬────────────┬──────────────────────┬────┬───────┬────────────────────────────────────────────────────────────────────────┐
│ CIDR               │ ASN        │ Name                 │ CC │ Count │ FQDNs                                                                  │
├────────────────────┼────────────┼──────────────────────┼────┼───────┼────────────────────────────────────────────────────────────────────────┤
│ 185.199.108.0/22   │ 54113      │ FASTLY               │ US │     1 │ docs.github.com                                                        │
├────────────────────┼────────────┼──────────────────────┼────┼───────┼────────────────────────────────────────────────────────────────────────┤
│ unresolved         │ -          │ -                    │ -  │     1 │ unresolved.docs.github.com                                             │
└────────────────────┴────────────┴──────────────────────┴────┴───────┴────────────────────────────────────────────────────────────────────────┘
```

## Known limitations

- **CIDRs are wider than the real BGP prefix.** iptoasn aggregates adjacent
  prefixes of the same ASN. This is intentional.
- **Subdomains are publicly known only.** Sourced from crt.sh (CT logs) and
  subfinder. No dictionary brute-force.
- **IPv4 only.** AAAA records are ignored.
- **subfinder is an external binary.** Without it, recursive mode fail when `-S` is specified. Recursive mode (`-r`) requires at least one of `-C` / `-S`.

## License

MIT.
