// Binary format of db.bin (little-endian).
//
// Header (32 bytes):
//   magic                "H2CD"             4
//   version              uint32             4
//   source_timestamp_ms  bigint64 (LE)      8
//   range_count          uint32             4
//   asn_count            uint32             4
//   asn_table_offset     uint32             4
//   string_table_offset  uint32             4
//
// Ranges section (16 × range_count):
//   range_start          uint32
//   range_end            uint32
//   asn_index            uint32
//   flags                uint32 (=0)
//
// ASN table (16 × asn_count):
//   asn_number           uint32
//   name_offset          uint32
//   name_length          uint16
//   country_length       uint16   (country offset = name_offset + name_length)

export const MAGIC_BYTES = new Uint8Array([0x48, 0x32, 0x43, 0x44]); // 'H','2','C','D'
export const FORMAT_VERSION = 1;

export const HEADER_SIZE = 32;
export const RANGE_RECORD_SIZE = 16;
export const ASN_RECORD_SIZE = 16;

export const HEADER_OFFSETS = {
  magic: 0,
  version: 4,
  sourceTimestamp: 8,
  rangeCount: 16,
  asnCount: 20,
  asnTableOffset: 24,
  stringTableOffset: 28,
} as const;

export const RANGE_OFFSETS = {
  start: 0,
  end: 4,
  asnIndex: 8,
  flags: 12,
} as const;

export const ASN_RECORD_OFFSETS = {
  number: 0,
  nameOffset: 4,
  nameLength: 8,
  countryLength: 10,
} as const;
