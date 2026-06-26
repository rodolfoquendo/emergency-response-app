import { b64, unb64 } from './keys';
import type { PublicKeyBundle } from './keys';

export type ContactCard = {
  alias:        string;
  signPublicKey: string;  // base64
  boxPublicKey:  string;  // base64
};

const SCHEME = 'quakelink://contact';

/** Encode a contact card as a deep link URL. Safe to share via any channel. */
export function encodeContactLink(alias: string, keys: PublicKeyBundle): string {
  const params = new URLSearchParams({
    alias,
    spk: b64(keys.signPublicKey),
    bpk: b64(keys.boxPublicKey),
  });
  return `${SCHEME}?${params.toString()}`;
}

/** Parse a contact card from a deep link URL. Returns null if malformed. */
export function decodeContactLink(url: string): ContactCard | null {
  try {
    const raw = url.replace(SCHEME + '?', '');
    const params = new URLSearchParams(raw);
    const alias = params.get('alias');
    const spk   = params.get('spk');
    const bpk   = params.get('bpk');
    if (!alias || !spk || !bpk) return null;
    // Validate key lengths
    if (unb64(spk).length !== 32 || unb64(bpk).length !== 32) return null;
    return { alias, signPublicKey: spk, boxPublicKey: bpk };
  } catch {
    return null;
  }
}

/** Encode contact card as a compact JSON string (for QR code payload). */
export function encodeContactQR(alias: string, keys: PublicKeyBundle): string {
  return JSON.stringify({
    a: alias,
    s: b64(keys.signPublicKey),
    b: b64(keys.boxPublicKey),
  });
}

/** Parse a QR code payload into a ContactCard. Returns null if malformed. */
export function decodeContactQR(json: string): ContactCard | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed.a || !parsed.s || !parsed.b) return null;
    if (unb64(parsed.s).length !== 32 || unb64(parsed.b).length !== 32) return null;
    return { alias: parsed.a, signPublicKey: parsed.s, boxPublicKey: parsed.b };
  } catch {
    return null;
  }
}
