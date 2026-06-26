import { useState, useCallback, useRef } from 'react';
import { SeismographModule } from './SeismographModule';
import type { SeismicReading, SeismographOptions } from './types';

const BUFFER_SIZE = 200;
const GRAVITY = 9.81;

function estimateMagnitude(readings: SeismicReading[]): number {
  if (readings.length === 0) return 0;
  const recent = readings.slice(-20);
  // Subtract 1g (GRAVITY) from the total vector magnitude to isolate dynamic
  // acceleration; a phone lying still reads ~9.81 m/s² even at rest.
  const pgv = recent.reduce((max, r) => {
    const acc = Math.sqrt(r.x ** 2 + r.y ** 2 + r.z ** 2);
    return Math.max(max, Math.abs(acc - GRAVITY));
  }, 0);
  // Rough PGA (m/s²) → Richter-like magnitude.
  // Reference point 0.001 m/s² ≈ M0; 0.8 scaling keeps the range sane for
  // consumer accelerometers (not seismometers). Replace with a calibrated
  // regional attenuation model if accuracy matters.
  if (pgv < 0.01) return 0;
  return Math.log10(pgv / 0.001) * 0.8;
}

export function useSeismograph(options: SeismographOptions = {}) {
  const [readings, setReadings] = useState<SeismicReading[]>([]);
  const [magnitude, setMagnitude] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const subscriptionRef = useRef<ReturnType<typeof SeismographModule.addReadingListener> | null>(null);

  const start = useCallback(() => {
    if (isActive) return;
    SeismographModule.startMonitoring(options);
    subscriptionRef.current = SeismographModule.addReadingListener((reading) => {
      setReadings((prev) => {
        const next = [...prev, reading].slice(-(options.bufferSize ?? BUFFER_SIZE));
        setMagnitude(estimateMagnitude(next));
        return next;
      });
    });
    setIsActive(true);
  }, [isActive, options]);

  const stop = useCallback(() => {
    SeismographModule.stopMonitoring();
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setIsActive(false);
  }, []);

  return { readings, magnitude, isActive, start, stop };
}
