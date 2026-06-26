import { generateMnemonic, mnemonicToEntropy, validateMnemonic, entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

/** Generate a fresh 12-word seed phrase (128 bits of entropy). */
export function generateSeedPhrase(): string {
  return generateMnemonic(wordlist, 128);
}

/** Convert seed phrase → raw 16-byte entropy. Throws if invalid. */
export function seedPhraseToEntropy(phrase: string): Uint8Array {
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error('Invalid seed phrase');
  }
  return mnemonicToEntropy(normalized, wordlist);
}

/** Convert raw entropy back to seed phrase (for restore verification). */
export function entropyToSeedPhrase(entropy: Uint8Array): string {
  return entropyToMnemonic(entropy, wordlist);
}

/** Validate a seed phrase without throwing. */
export function isValidSeedPhrase(phrase: string): boolean {
  try {
    const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
    return validateMnemonic(normalized, wordlist);
  } catch {
    return false;
  }
}

/** Split phrase into word array. */
export function splitPhrase(phrase: string): string[] {
  return phrase.trim().toLowerCase().replace(/\s+/g, ' ').split(' ');
}
