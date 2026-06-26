import type { EarthquakeAlert } from '@quakelink/consensus';
import type { WebhookConfig, WebhookPayload, WebhookResult } from './types';

const RETRY_DELAYS_MS = [1_000, 5_000, 15_000]; // exponential-ish backoff

function buildPayload(alert: EarthquakeAlert): WebhookPayload {
  return {
    event:        'earthquake_alert',
    id:           alert.id,
    magnitude:    alert.magnitude,
    avgMagnitude: alert.avgMagnitude,
    confidence:   alert.confidence,
    confirmedBy:  alert.confirmedBy,
    timestamp:    alert.timestamp,
    issuedAt:     new Date().toISOString(),
  };
}

async function attemptPost(
  url: string,
  payload: WebhookPayload,
  secret?: string,
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent':   'QuakeLink/1.0',
    };
    if (secret) headers['X-QuakeLink-Secret'] = secret;

    const res = await fetch(url, {
      method:  'POST',
      headers,
      body:    JSON.stringify(payload),
    });

    return { success: res.ok, status: res.status };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/** Fire a single webhook with retry logic. */
export async function fireWebhook(
  config: WebhookConfig,
  alert: EarthquakeAlert,
): Promise<WebhookResult> {
  const payload    = buildPayload(alert);
  const maxRetries = config.maxRetries ?? 3;
  let attempts     = 0;
  let lastError    = '';

  for (let i = 0; i < maxRetries; i++) {
    attempts++;
    const result = await attemptPost(config.url, payload, config.secret);

    if (result.success) {
      return { url: config.url, success: true, status: result.status, attempts };
    }

    lastError = result.error ?? `HTTP ${result.status}`;

    // Wait before retry (skip delay on last attempt)
    if (i < maxRetries - 1) {
      await delay(RETRY_DELAYS_MS[i] ?? 15_000);
    }
  }

  return { url: config.url, success: false, error: lastError, attempts };
}

/** Fire all configured webhooks in parallel. */
export async function fireAllWebhooks(
  configs: WebhookConfig[],
  alert: EarthquakeAlert,
): Promise<WebhookResult[]> {
  if (configs.length === 0) return [];
  return Promise.all(configs.map((cfg) => fireWebhook(cfg, alert)));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
