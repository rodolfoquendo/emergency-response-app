import nacl from 'tweetnacl';
import { sha256 } from '@noble/hashes/sha256';
import { seedPhraseToEntropy } from './mnemonic';

export type KeyBundle = {
  /** Ed25519 public key — your identity, safe to share */
  signPublicKey: Uint8Array;
  /** Ed25519 private key — never share, never log */
  signSecretKey: Uint8Array;
  /** X25519 public key — your encryption address, safe to share */
  boxPublicKey: Uint8Array;
  /** X25519 private key — never share, never log */
  boxSecretKey: Uint8Array;
};

export type PublicKeyBundle = {
  signPublicKey: Uint8Array;
  boxPublicKey: Uint8Array;
};

/**
 * Derive a deterministic KeyBundle from a 12-word seed phrase.
 * Domain-separated hashing means sign and box keys are independent.
 */
export function deriveKeysFromPhrase(phrase: string): KeyBundle {
  const entropy = seedPhraseToEntropy(phrase);
  return deriveKeysFromEntropy(entropy);
}

export function deriveKeysFromEntropy(entropy: Uint8Array): KeyBundle {
  const signSeed = sha256(concat(entropy, encode('quakelink-sign-v1')));
  const boxSeed  = sha256(concat(entropy, encode('quakelink-box-v1')));

  const signPair = nacl.sign.keyPair.fromSeed(signSeed);
  const boxPair  = nacl.box.keyPair.fromSecretKey(boxSeed);

  return {
    signPublicKey: signPair.publicKey,
    signSecretKey: signPair.secretKey,
    boxPublicKey:  boxPair.publicKey,
    boxSecretKey:  boxPair.secretKey,
  };
}

/** Encode keys as base64 strings for storage / transport. */
export function encodeKeys(keys: KeyBundle) {
  return {
    signPublicKey: b64(keys.signPublicKey),
    signSecretKey: b64(keys.signSecretKey),
    boxPublicKey:  b64(keys.boxPublicKey),
    boxSecretKey:  b64(keys.boxSecretKey),
  };
}

export function decodeKeys(encoded: ReturnType<typeof encodeKeys>): KeyBundle {
  return {
    signPublicKey: unb64(encoded.signPublicKey),
    signSecretKey: unb64(encoded.signSecretKey),
    boxPublicKey:  unb64(encoded.boxPublicKey),
    boxSecretKey:  unb64(encoded.boxSecretKey),
  };
}

export function encodePublicBundle(keys: PublicKeyBundle) {
  return {
    signPublicKey: b64(keys.signPublicKey),
    boxPublicKey:  b64(keys.boxPublicKey),
  };
}

export function decodePublicBundle(encoded: ReturnType<typeof encodePublicBundle>): PublicKeyBundle {
  return {
    signPublicKey: unb64(encoded.signPublicKey),
    boxPublicKey:  unb64(encoded.boxPublicKey),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

function encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function b64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function unb64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'base64'));
}
