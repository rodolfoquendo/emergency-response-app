import * as SecureStore from 'expo-secure-store';
import type { IntegrationsConfig } from './types';

const KEY = 'ql_integrations';

const DEFAULT: IntegrationsConfig = { webhooks: [] };

export async function loadIntegrationsConfig(): Promise<IntegrationsConfig> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return DEFAULT;
  try {
    return JSON.parse(raw) as IntegrationsConfig;
  } catch {
    return DEFAULT;
  }
}

export async function saveIntegrationsConfig(config: IntegrationsConfig): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(config));
}
