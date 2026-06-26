import nacl from 'tweetnacl';
import { b64, unb64 } from './keys';

export type EncryptedPayload = {
  nonce:      string;  // base64 24-byte random nonce
  ciphertext: string;  // base64 NaCl box output
};

/**
 * Encrypt a message from sender to recipient.
 * Only the recipient (holding recipientSecretKey) can decrypt.
 */
export function encrypt(
  message: Uint8Array,
  recipientBoxPublicKey: Uint8Array,
  senderBoxSecretKey: Uint8Array,
): EncryptedPayload {
  const nonce = nacl.randomBytes(24);
  const ciphertext = nacl.box(message, nonce, recipientBoxPublicKey, senderBoxSecretKey);
  return { nonce: b64(nonce), ciphertext: b64(ciphertext) };
}

/**
 * Decrypt a message. Returns null if tampered or wrong key.
 */
export function decrypt(
  payload: EncryptedPayload,
  senderBoxPublicKey: Uint8Array,
  recipientBoxSecretKey: Uint8Array,
): Uint8Array | null {
  return nacl.box.open(
    unb64(payload.ciphertext),
    unb64(payload.nonce),
    senderBoxPublicKey,
    recipientBoxSecretKey,
  );
}

export function encryptText(
  text: string,
  recipientBoxPublicKey: Uint8Array,
  senderBoxSecretKey: Uint8Array,
): EncryptedPayload {
  return encrypt(new TextEncoder().encode(text), recipientBoxPublicKey, senderBoxSecretKey);
}

export function decryptText(
  payload: EncryptedPayload,
  senderBoxPublicKey: Uint8Array,
  recipientBoxSecretKey: Uint8Array,
): string | null {
  const bytes = decrypt(payload, senderBoxPublicKey, recipientBoxSecretKey);
  return bytes ? new TextDecoder().decode(bytes) : null;
}
