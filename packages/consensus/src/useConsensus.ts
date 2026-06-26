import { useEffect, useRef, useState } from 'react';
import { ConsensusEngine } from './ConsensusEngine';
import type { EarthquakeAlert, ConsensusConfig, SeismicEvent } from './types';
import type { SeismicReading } from '@quakelink/seismograph';
import type { MeshMessage } from '@quakelink/mesh';

type UseConsensusOptions = Partial<ConsensusConfig> & {
  nodeId: string;
};

type UseConsensusReturn = {
  alert:       EarthquakeAlert | null;
  alertHistory: EarthquakeAlert[];
  ingestLocalReading: (reading: SeismicReading, magnitude: number) => void;
  ingestMeshMessage:  (message: MeshMessage) => void;
  dismissAlert: () => void;
};

const GRAVITY = 9.81;

export function useConsensus({ nodeId, ...config }: UseConsensusOptions): UseConsensusReturn {
  const engine      = useRef(new ConsensusEngine(config));
  const [alert, setAlert]           = useState<EarthquakeAlert | null>(null);
  const [alertHistory, setHistory]  = useState<EarthquakeAlert[]>([]);

  useEffect(() => {
    engine.current.updateConfig(config);
  }, [JSON.stringify(config)]);

  useEffect(() => {
    const unsub = engine.current.onAlert((confirmed) => {
      setAlert(confirmed);
      setHistory((prev) => [confirmed, ...prev].slice(0, 50));
    });
    return unsub;
  }, []);

  /** Call this from useSeismograph's reading stream when magnitude >= threshold. */
  const ingestLocalReading = (reading: SeismicReading, magnitude: number) => {
    const event: SeismicEvent = {
      source:    'local',
      magnitude,
      timestamp: reading.timestamp,
      isLocal:   true,
    };
    engine.current.ingest(event);
  };

  /**
   * Call this for every incoming mesh message.
   * Only messages of type 'seismic' are processed; others are ignored.
   */
  const ingestMeshMessage = (message: MeshMessage) => {
    if (message.type !== 'seismic') return;
    if (message.fromSelf) return;

    let magnitude = 0;
    try {
      const parsed = JSON.parse(message.text);
      magnitude = typeof parsed.magnitude === 'number' ? parsed.magnitude : 0;
    } catch {
      return;
    }

    if (magnitude <= 0) return;

    const event: SeismicEvent = {
      source:    message.fromId,
      magnitude,
      timestamp: message.timestamp,
      isLocal:   false,
    };
    engine.current.ingest(event);
  };

  const dismissAlert = () => setAlert(null);

  return { alert, alertHistory, ingestLocalReading, ingestMeshMessage, dismissAlert };
}

/** Build the JSON payload a node broadcasts when its local sensor fires. */
export function buildSeismicPayload(magnitude: number): string {
  return JSON.stringify({ magnitude: parseFloat(magnitude.toFixed(2)) });
}
