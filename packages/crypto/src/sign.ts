import nacl from 'tweetnacl';
import { b64, unb64 } from './keys';
import type { EncryptedPayload } from './encrypt';

export type SignedEnvelope = {
  from:       string;   // base64 sender Ed25519 public key (their identity)
  to:         string;   // base64 recipient X25519 public key
  payload:    EncryptedPayload;
  sig:        string;   // base64 Ed25519 sig over canonical message bytes
  timestamp:  number;
  ttl:        number;   // hop count remaining
};

/**
 * Sign an encrypted payload. Relaying nodes can verify integrity
 * without being able to read the contents.
 */
export function signEnvelope(
  payload: EncryptedPayload,
  recipientBoxPublicKey: Uint8Array,
  senderSignPublicKey: Uint8Array,
  senderSignSecretKey: Uint8Array,
  ttl = 7,
): SignedEnvelope {
  const timestamp = Date.now();
  const canonical = canonicalize(payload, timestamp);
  const sig = nacl.sign.detached(canonical, senderSignSecretKey);

  return {
    from:      b64(senderSignPublicKey),
    to:        b64(recipientBoxPublicKey),
    payload,
    sig:       b64(sig),
    timestamp,
    ttl,
  };
}

/**
 * Verify a signed envelope. Returns false if tampered or replayed (>5 min old).
 * Relaying nodes call this before forwarding.
 */
export function verifyEnvelope(envelope: SignedEnvelope): boolean {
  const age = Date.now() - envelope.timestamp;
  if (age > 5 * 60 * 1000 || age < -30_000) return false;

  const canonical = canonicalize(envelope.payload, envelope.timestamp);
  return nacl.sign.detached.verify(canonical, unb64(envelope.sig), unb64(envelope.from));
}

/** Decrement TTL before forwarding. Returns null if TTL exhausted. */
export function hopEnvelope(envelope: SignedEnvelope): SignedEnvelope | null {
  if (envelope.ttl <= 0) return null;
  return { ...envelope, ttl: envelope.ttl - 1 };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function canonicalize(payload: EncryptedPayload, timestamp: number): Uint8Array {
  const str = JSON.stringify({ nonce: payload.nonce, ciphertext: payload.ciphertext, timestamp });
  return new TextEncoder().encode(str);
}
