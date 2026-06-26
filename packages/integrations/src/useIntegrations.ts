import { useState, useEffect, useCallback } from 'react';
import { fireAllWebhooks } from './webhook';
import { loadIntegrationsConfig, saveIntegrationsConfig } from './store';
import type { IntegrationsConfig, WebhookConfig, WebhookResult } from './types';
import type { EarthquakeAlert } from '@quakelink/consensus';

type UseIntegrationsReturn = {
  config:        IntegrationsConfig;
  lastResults:   WebhookResult[];
  isLoading:     boolean;
  addWebhook:    (webhook: WebhookConfig) => Promise<void>;
  removeWebhook: (url: string) => Promise<void>;
  testWebhook:   (webhook: WebhookConfig) => Promise<WebhookResult>;
  fireAlert:     (alert: EarthquakeAlert) => Promise<void>;
};

export function useIntegrations(): UseIntegrationsReturn {
  const [config, setConfig]         = useState<IntegrationsConfig>({ webhooks: [] });
  const [lastResults, setResults]   = useState<WebhookResult[]>([]);
  const [isLoading, setIsLoading]   = useState(true);

  useEffect(() => {
    loadIntegrationsConfig()
      .then(setConfig)
      .finally(() => setIsLoading(false));
  }, []);

  const persist = async (next: IntegrationsConfig) => {
    setConfig(next);
    await saveIntegrationsConfig(next);
  };

  const addWebhook = useCallback(async (webhook: WebhookConfig) => {
    const next = {
      ...config,
      webhooks: [
        ...config.webhooks.filter((w) => w.url !== webhook.url),
        webhook,
      ],
    };
    await persist(next);
  }, [config]);

  const removeWebhook = useCallback(async (url: string) => {
    const next = {
      ...config,
      webhooks: config.webhooks.filter((w) => w.url !== url),
    };
    await persist(next);
  }, [config]);

  const testWebhook = useCallback(async (webhook: WebhookConfig): Promise<WebhookResult> => {
    const mockAlert: EarthquakeAlert = {
      id:           'ql-test',
      magnitude:    3.2,
      avgMagnitude: 3.0,
      confirmedBy:  3,
      confidence:   'medium',
      timestamp:    Date.now(),
      events:       [],
    };
    const [result] = await fireAllWebhooks([webhook], mockAlert);
    return result;
  }, []);

  const fireAlert = useCallback(async (alert: EarthquakeAlert) => {
    if (config.webhooks.length === 0) return;
    const results = await fireAllWebhooks(config.webhooks, alert);
    setResults(results);
  }, [config.webhooks]);

  return { config, lastResults, isLoading, addWebhook, removeWebhook, testWebhook, fireAlert };
}
