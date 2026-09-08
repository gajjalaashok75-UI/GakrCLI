/**
 * RFC 6238 TOTP code generation for WebBrowserTool's `<secret>` preprocessing.
 *
 * Used when a `sensitive_data` key ends with `bu_2fa_code` (or `totp`): the
 * stored value is treated as a base32-encoded shared secret, and a fresh
 * 6-digit code is generated from the current 30-second time window.
 *
 * Implementation follows browser-use's `decodeBase32Secret` +
 * `generateTotpCode` (HMAC-SHA1, 6 digits, 30s period).
 */
import { createHmac } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decode a base32 string to its raw bytes, ignoring padding and case. */
export const decodeBase32Secret = (secret: string): Buffer => {
  const clean = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  if (!clean) {
    throw new Error('Invalid TOTP secret: empty payload');
  }
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) {
      throw new Error(`Invalid TOTP secret: unexpected character '${ch}'`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  if (bytes.length === 0) {
    throw new Error('Invalid TOTP secret: failed to decode base32 payload');
  }
  return Buffer.from(bytes);
};

/** Generate a 6-digit TOTP code for the current 30-second window. */
export const generateTotpCode = (secret: string): string => {
  const key = decodeBase32Secret(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binaryCode % 1_000_000).padStart(6, '0');
};
