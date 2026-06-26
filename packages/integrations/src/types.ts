import type { EarthquakeAlert } from '@quakelink/consensus';

export type WebhookConfig = {
  url:      string;
  /** Optional secret added as X-QuakeLink-Secret header */
  secret?:  string;
  /** Maximum retry attempts on failure. Default: 3 */
  maxRetries?: number;
};

export type IntegrationsConfig = {
  webhooks: WebhookConfig[];
};

export type WebhookPayload = {
  event:       'earthquake_alert';
  id:          string;
  magnitude:   number;
  avgMagnitude: number;
  confidence:  string;
  confirmedBy: number;
  timestamp:   number;
  issuedAt:    string;  // ISO 8601
};

export type WebhookResult = {
  url:     string;
  success: boolean;
  status?: number;
  error?:  string;
  attempts: number;
};
