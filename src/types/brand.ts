declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

export type Ipv4 = Brand<string, 'Ipv4'>;
export type Ipv4Int = Brand<number, 'Ipv4Int'>;
export type Cidr = Brand<string, 'Cidr'>;
export type Fqdn = Brand<string, 'Fqdn'>;
export type AsNumber = Brand<number, 'AsNumber'>;

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const FQDN_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function asIpv4(s: string): Ipv4 {
  const m = IPV4_RE.exec(s);
  if (!m) throw new Error(`Invalid IPv4: ${s}`);
  for (let i = 1; i <= 4; i++) {
    const part = m[i];
    if (part === undefined) throw new Error(`Invalid IPv4: ${s}`);
    const n = Number(part);
    if (n < 0 || n > 255) throw new Error(`Invalid IPv4 octet: ${s}`);
    if (part.length > 1 && part.startsWith('0')) throw new Error(`Leading zero in IPv4: ${s}`);
  }
  return s as Ipv4;
}

export function asFqdn(s: string): Fqdn {
  if (s.length === 0 || s.length > 253) throw new Error(`Invalid FQDN length: ${s}`);
  const lower = s.toLowerCase().replace(/\.$/, '');
  if (lower.length === 0) throw new Error(`Invalid FQDN: ${s}`);
  const labels = lower.split('.');
  if (labels.length < 2) throw new Error(`Not a FQDN (need at least 2 labels): ${s}`);
  for (const label of labels) {
    if (!FQDN_LABEL_RE.test(label)) throw new Error(`Invalid FQDN label "${label}" in ${s}`);
  }
  return lower as Fqdn;
}

export function asCidr(s: string): Cidr {
  const slash = s.indexOf('/');
  if (slash < 0) throw new Error(`Not a CIDR: ${s}`);
  const ip = s.slice(0, slash);
  const prefix = Number(s.slice(slash + 1));
  asIpv4(ip);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR prefix: ${s}`);
  }
  return s as Cidr;
}

export function asAsNumber(n: number): AsNumber {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid AS number: ${n}`);
  return n as AsNumber;
}
