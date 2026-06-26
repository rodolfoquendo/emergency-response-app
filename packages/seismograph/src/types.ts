export type SeismicReading = {
  x: number;
  y: number;
  z: number;
  timestamp: number;
};

export type SeismographOptions = {
  /** Sampling interval in milliseconds. Default: 50 (20 Hz) */
  intervalMs?: number;
  /** Buffer size — number of readings to keep. Default: 200 */
  bufferSize?: number;
};
