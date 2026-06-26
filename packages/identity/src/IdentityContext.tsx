import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadIdentity, saveIdentity, deleteIdentity, loadContacts, saveContact, deleteContact } from './store';
import type { Identity, StoredContact } from './types';

type IdentityContextValue = {
  identity:       Identity | null;
  contacts:       StoredContact[];
  isLoading:      boolean;
  createIdentity: (alias: string, phrase: string) => Promise<void>;
  wipeIdentity:   () => Promise<void>;
  addContact:     (contact: Omit<StoredContact, 'addedAt'>) => Promise<void>;
  removeContact:  (signPublicKey: string) => Promise<void>;
};

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity]   = useState<Identity | null>(null);
  const [contacts, setContacts]   = useState<StoredContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadIdentity(), loadContacts()])
      .then(([id, ct]) => {
        setIdentity(id);
        setContacts(ct);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const createIdentity = async (alias: string, phrase: string) => {
    const id = await saveIdentity(alias, phrase);
    setIdentity(id);
  };

  const wipeIdentity = async () => {
    await deleteIdentity();
    setIdentity(null);
  };

  const addContact = async (contact: Omit<StoredContact, 'addedAt'>) => {
    await saveContact(contact);
    setContacts(await loadContacts());
  };

  const removeContact = async (signPublicKey: string) => {
    await deleteContact(signPublicKey);
    setContacts((prev) => prev.filter((c) => c.signPublicKey !== signPublicKey));
  };

  return (
    <IdentityContext.Provider value={{ identity, contacts, isLoading, createIdentity, wipeIdentity, addContact, removeContact }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityContextValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error('useIdentity must be used inside IdentityProvider');
  return ctx;
}
