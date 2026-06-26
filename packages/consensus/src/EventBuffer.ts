import type { SeismicEvent } from './types';

/**
 * Sliding-window buffer of seismic events.
 * Automatically discards events older than windowMs.
 * Deduplicates: only the most recent event per source is kept.
 */
export class EventBuffer {
  private events: Map<string, SeismicEvent> = new Map();

  constructor(private windowMs: number) {}

  add(event: SeismicEvent): void {
    // Keep only the latest event per source; earlier readings from same node
    // don't count as additional confirmation.
    const existing = this.events.get(event.source);
    if (!existing || event.timestamp > existing.timestamp) {
      this.events.set(event.source, event);
    }
  }

  /** Return all events within the current window. */
  current(): SeismicEvent[] {
    const cutoff = Date.now() - this.windowMs;
    const live: SeismicEvent[] = [];
    for (const [source, event] of this.events) {
      if (event.timestamp >= cutoff) {
        live.push(event);
      } else {
        this.events.delete(source);
      }
    }
    return live;
  }

  clear(): void {
    this.events.clear();
  }
}
