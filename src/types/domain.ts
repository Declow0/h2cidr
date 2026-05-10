import type { AsNumber, Cidr, Fqdn, Ipv4 } from './brand.js';

export interface AsnRecord {
  readonly number: AsNumber;
  readonly name: string;
  readonly country: string;
}

export interface RangeMatch {
  readonly rangeStart: Ipv4;
  readonly rangeEnd: Ipv4;
  readonly cidrs: readonly Cidr[];
  readonly asn: AsnRecord;
}

export interface FqdnLookup {
  readonly kind: 'lookup-result';
  readonly fqdn: Fqdn;
  readonly ips: readonly Ipv4[];
  readonly matches: readonly RangeMatch[];
  readonly generatedAt: Date;
}

export interface DomainGroup {
  readonly match: RangeMatch;
  readonly fqdns: readonly Fqdn[];
  readonly ips: readonly Ipv4[];
}

export interface DomainReport {
  readonly kind: 'domain-report';
  readonly domain: Fqdn;
  readonly providers: readonly string[];
  readonly groups: readonly DomainGroup[];
  readonly unresolved: readonly Fqdn[];
  readonly errors: readonly { readonly source: string; readonly message: string }[];
  readonly generatedAt: Date;
}

export type FormattableInput = FqdnLookup | DomainReport;
