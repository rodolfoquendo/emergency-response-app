import type { ContactCard } from '@quakelink/crypto';

export type Identity = {
  /** Display name chosen by user */
  alias: string;
  /** base64 Ed25519 public key — their network identity */
  signPublicKey: string;
  /** base64 Ed25519 secret key */
  signSecretKey: string;
  /** base64 X25519 public key — their encryption address */
  boxPublicKey: string;
  /** base64 X25519 secret key */
  boxSecretKey: string;
};

export type StoredContact = ContactCard & {
  addedAt: number;
  favorite: boolean;
};
