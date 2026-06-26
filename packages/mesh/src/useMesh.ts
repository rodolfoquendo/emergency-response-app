import { useState, useCallback, useEffect, useRef } from 'react';
import { BleTransport } from './ble';
import { MeshtasticTransport } from './meshtastic';
import type { MeshMessage, MeshPeer, SendPayload } from './types';

function generateNodeId(): string {
  return `ql-${Math.random().toString(36).slice(2, 10)}`;
}

export function useMesh() {
  const [messages, setMessages] = useState<MeshMessage[]>([]);
  const [peers, setPeers] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  const nodeId = useRef(generateNodeId());
  const ble = useRef(new BleTransport(nodeId.current));
  const lora = useRef(new MeshtasticTransport(nodeId.current));

  useEffect(() => {
    // Start BLE scan for Meshtastic devices nearby
    ble.current.scan((deviceId, rssi) => {
      setPeers((p) => p + 1);
      ble.current.connect(deviceId).then(() => {
        setIsConnected(true);
        ble.current.onReceive((msg) => {
          setMessages((prev) => [msg, ...prev].slice(0, 500));
        });
      }).catch(() => {});
    });

    // LoRa listener (called when BLE bridge relays LoRa packets)
    const unsubLora = lora.current.onMessage((msg) => {
      setMessages((prev) => [msg, ...prev].slice(0, 500));
    });

    return () => {
      ble.current.stopScan();
      ble.current.destroy();
      unsubLora();
    };
  }, []);

  const sendMessage = useCallback(async (payload: SendPayload) => {
    const outgoing: MeshMessage = {
      id: `${Date.now()}-self`,
      text: payload.text,
      type: payload.type,
      fromId: nodeId.current,
      fromSelf: true,
      timestamp: Date.now(),
      hops: 0,
      channel: isConnected ? 'lora' : 'ble',
    };

    setMessages((prev) => [outgoing, ...prev]);

    try {
      if (isConnected) {
        await lora.current.send(payload);
      } else {
        await ble.current.send(payload);
      }
    } catch (err) {
      console.warn('[Mesh] Send failed:', err);
    }
  }, [isConnected]);

  return { messages, sendMessage, peers, isConnected };
}
