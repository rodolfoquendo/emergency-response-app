export type SeismicEventSource = 'local' | string; // 'local' or a peer nodeId

export type SeismicEvent = {
  source:     SeismicEventSource;
  magnitude:  number;
  timestamp:  number;
  isLocal:    boolean;
};

export type Confidence = 'low' | 'medium' | 'high';

export type EarthquakeAlert = {
  id:          string;
  magnitude:   number;    // max magnitude across all confirming events
  avgMagnitude: number;   // average
  confirmedBy: number;    // unique node count
  confidence:  Confidence;
  timestamp:   number;    // time of first detection in this window
  events:      SeismicEvent[];
};

export type ConsensusConfig = {
  /** Minimum independent nodes needed to confirm. Default: 3 */
  minNodes:       number;
  /** Time window for grouping events (ms). Default: 30_000 */
  windowMs:       number;
  /** Ignore events below this magnitude. Default: 2.0 */
  minMagnitude:   number;
  /** Minimum gap between alerts to avoid re-triggering (ms). Default: 300_000 */
  cooldownMs:     number;
};

export const DEFAULT_CONFIG: ConsensusConfig = {
  minNodes:     3,
  windowMs:     30_000,
  minMagnitude: 2.0,
  cooldownMs:   300_000,
};
