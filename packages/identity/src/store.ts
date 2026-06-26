import * as SecureStore from 'expo-secure-store';
import { deriveKeysFromPhrase, encodeKeys, decodeKeys } from '@quakelink/crypto';
import type { Identity, StoredContact } from './types';

const KEY_IDENTITY  = 'ql_identity';
const KEY_CONTACTS  = 'ql_contacts';

// ── Identity ──────────────────────────────────────────────────────────────────

export async function saveIdentity(alias: string, phrase: string): Promise<Identity> {
  const keys    = deriveKeysFromPhrase(phrase);
  const encoded = encodeKeys(keys);
  const identity: Identity = { alias, ...encoded };
  await SecureStore.setItemAsync(KEY_IDENTITY, JSON.stringify(identity));
  return identity;
}

export async function loadIdentity(): Promise<Identity | null> {
  const raw = await SecureStore.getItemAsync(KEY_IDENTITY);
  if (!raw) return null;
  return JSON.parse(raw) as Identity;
}

export async function deleteIdentity(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_IDENTITY);
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function loadContacts(): Promise<StoredContact[]> {
  const raw = await SecureStore.getItemAsync(KEY_CONTACTS);
  if (!raw) return [];
  return JSON.parse(raw) as StoredContact[];
}

export async function saveContact(contact: Omit<StoredContact, 'addedAt'>): Promise<void> {
  const contacts = await loadContacts();
  const exists   = contacts.findIndex((c) => c.signPublicKey === contact.signPublicKey);
  const entry: StoredContact = { ...contact, addedAt: Date.now() };

  if (exists >= 0) {
    contacts[exists] = entry;
  } else {
    contacts.push(entry);
  }

  await SecureStore.setItemAsync(KEY_CONTACTS, JSON.stringify(contacts));
}

export async function deleteContact(signPublicKey: string): Promise<void> {
  const contacts = await loadContacts();
  const filtered = contacts.filter((c) => c.signPublicKey !== signPublicKey);
  await SecureStore.setItemAsync(KEY_CONTACTS, JSON.stringify(filtered));
}
