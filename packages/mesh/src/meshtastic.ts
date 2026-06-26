import type { MeshMessage, MeshPeer, SendPayload } from './types';

/**
 * LoRa transport via a connected Meshtastic device (BLE bridge).
 * The Meshtastic device handles all RF; this layer just talks to it over BLE
 * using the Meshtastic protobuf packet format.
 *
 * For production integration, use @meshtastic/js for proper protobuf encoding.
 */
export class MeshtasticTransport {
  private nodeId: string;
  private peers: Map<string, MeshPeer> = new Map();
  private listeners: Array<(msg: MeshMessage) => void> = [];

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  getPeers(): MeshPeer[] {
    return Array.from(this.peers.values());
  }

  onMessage(callback: (msg: MeshMessage) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  async send(payload: SendPayload): Promise<void> {
    // Broadcast over LoRa via the connected Meshtastic device
    // The device relays to all nodes in range, which relay further (mesh flooding)
    const packet = buildLoraPacket(payload, this.nodeId);
    // In real integration: write packet to Meshtastic BLE TORADIO characteristic
    console.log('[LoRa] Queued packet:', packet.byteLength, 'bytes');
  }

  handleIncoming(raw: Uint8Array): void {
    const msg = parseLoraPacket(raw, this.nodeId);
    if (!msg) return;

    // Update peer table
    if (!msg.fromSelf) {
      this.peers.set(msg.fromId, {
        id: msg.fromId,
        alias: msg.fromAlias,
        rssi: -80,
        channel: 'lora',
        lastSeen: Date.now(),
      });
    }

    this.listeners.forEach((l) => l(msg));
  }
}

function buildLoraPacket(payload: SendPayload, fromId: string): Uint8Array {
  // Placeholder — production uses @meshtastic/js Protobuf MeshPacket
  const body = new TextEncoder().encode(JSON.stringify({ from: fromId, ...payload }));
  return body;
}

function parseLoraPacket(raw: Uint8Array, ownId: string): MeshMessage | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(raw));
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: parsed.text ?? '',
      type: parsed.type ?? 'chat',
      fromId: parsed.from ?? 'unknown',
      fromAlias: parsed.alias,
      fromSelf: parsed.from === ownId,
      timestamp: Date.now(),
      hops: parsed.hops ?? 0,
      channel: 'lora',
    };
  } catch {
    return null;
  }
}
