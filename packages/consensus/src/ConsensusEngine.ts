import { EventBuffer } from './EventBuffer';
import type { SeismicEvent, EarthquakeAlert, ConsensusConfig, Confidence } from './types';
import { DEFAULT_CONFIG } from './types';

type AlertListener = (alert: EarthquakeAlert) => void;

export class ConsensusEngine {
  private buffer:      EventBuffer;
  private config:      ConsensusConfig;
  private listeners:   AlertListener[] = [];
  private lastAlertAt  = 0;
  private alertCounter = 0;

  constructor(config: Partial<ConsensusConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.buffer = new EventBuffer(this.config.windowMs);
  }

  /**
   * Feed an event from local sensor or mesh peer.
   * Call this every time a detection occurs.
   */
  ingest(event: SeismicEvent): void {
    if (event.magnitude < this.config.minMagnitude) return;
    this.buffer.add(event);
    this.evaluate();
  }

  /** Subscribe to confirmed earthquake alerts. Returns an unsubscribe fn. */
  onAlert(listener: AlertListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  updateConfig(config: Partial<ConsensusConfig>): void {
    this.config = { ...this.config, ...config };
    this.buffer = new EventBuffer(this.config.windowMs);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private evaluate(): void {
    const now    = Date.now();
    const events = this.buffer.current().filter(
      (e) => e.magnitude >= this.config.minMagnitude,
    );

    const uniqueSources = new Set(events.map((e) => e.source));

    if (uniqueSources.size < this.config.minNodes) return;
    if (now - this.lastAlertAt < this.config.cooldownMs) return;

    this.lastAlertAt = now;
    this.buffer.clear(); // reset after firing so same quake doesn't re-trigger

    const magnitudes  = events.map((e) => e.magnitude);
    const maxMag      = Math.max(...magnitudes);
    const avgMag      = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const confidence  = this.score(uniqueSources.size, maxMag);

    const alert: EarthquakeAlert = {
      id:           `ql-quake-${++this.alertCounter}-${now}`,
      magnitude:    parseFloat(maxMag.toFixed(2)),
      avgMagnitude: parseFloat(avgMag.toFixed(2)),
      confirmedBy:  uniqueSources.size,
      confidence,
      timestamp:    Math.min(...events.map((e) => e.timestamp)),
      events,
    };

    this.listeners.forEach((l) => l(alert));
  }

  private score(nodeCount: number, magnitude: number): Confidence {
    // High: many nodes or strong signal
    if (nodeCount >= 7 || magnitude >= 5.0) return 'high';
    // Medium: solid confirmation or moderate signal
    if (nodeCount >= 5 || magnitude >= 3.5) return 'medium';
    return 'low';
  }
}
