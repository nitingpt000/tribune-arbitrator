import { createHash } from 'node:crypto';

export function hashU32(input: string): number {
  const buf = createHash('sha256').update(input).digest();
  return buf.readUInt32BE(0);
}

export function hashToFloat(input: string): number {
  return hashU32(input) / 0x1_0000_0000;
}

export function hashMod(input: string, mod: number): number {
  return hashU32(input) % mod;
}
