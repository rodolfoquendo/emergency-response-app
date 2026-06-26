import { create, toBinary, fromBinary } from '@bufbuild/protobuf';
import {
  MeshPacketSchema,
  DataSchema,
  FromRadioSchema,
  ToRadioSchema,
} from '@meshtastic/protobufs/lib/mesh_pb.js';
import { PortNum } from '@meshtastic/protobufs/lib/portnums_pb.js';
import type { MeshMessage, MeshPeer, SendPayload, MessageType } from './types';

const BROADCAST_ADDR = 0xffffffff;

/**
 * LoRa transport via a connected Meshtastic device (BLE bridge).
 * The Meshtastic device handles all RF; this layer serializes/deserializes
 * real Meshtastic protobuf packets and hands raw bytes to the BLE layer
 * (BleTransport) which writes them to the TORADIO characteristic.
 *
 * For actual BLE I/O, BleTransport owns the device connection. This class
 * is responsible only for packet encoding and peer tracking.
 */
export class MeshtasticTransport {
  private nodeId: string;
  private numericId: number;
  private peers: Map<string, MeshPeer> = new Map();
  private listeners: Array<(msg: MeshMessage) => void> = [];

  constructor(nodeId: string) {
    this.nodeId    = nodeId;
    this.numericId = stringToNodeId(nodeId);
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

  /** Encode a SendPayload into a ToRadio binary blob ready for TORADIO write. */
  encode(payload: SendPayload): Uint8Array {
    const meshPacket = create(MeshPacketSchema, {
      from: this.numericId,
      to: BROADCAST_ADDR,
      channel: 0,
      hopLimit: 7,
      wantAck: false,
      payloadVariant: {
        case: 'decoded',
        value: create(DataSchema, {
          portnum: PortNum.TEXT_MESSAGE_APP,
          payload: new TextEncoder().encode(`ql:${payload.type}:${payload.text}`),
        }),
      },
    });

    const toRadio = create(ToRadioSchema, {
      payloadVariant: { case: 'packet', value: meshPacket },
    });

    return toBinary(ToRadioSchema, toRadio);
  }

  /** Parse a raw binary blob from the FROMRADIO characteristic. */
  handleIncoming(raw: Uint8Array): void {
    const msg = this.decode(raw);
    if (!msg) return;

    if (!msg.fromSelf) {
      this.peers.set(msg.fromId, {
        id:       msg.fromId,
        rssi:     -80,
        channel:  'lora',
        lastSeen: Date.now(),
      });
    }

    this.listeners.forEach((l) => l(msg));
  }

  private decode(raw: Uint8Array): MeshMessage | null {
    try {
      const fromRadio = fromBinary(FromRadioSchema, raw);
      if (fromRadio.payloadVariant.case !== 'packet') return null;

      const packet = fromRadio.payloadVariant.value;
      if (packet.payloadVariant.case !== 'decoded') return null;

      const data     = packet.payloadVariant.value;
      const text_raw = new TextDecoder().decode(data.payload);
      const fromSelf = packet.from === this.numericId;

      let text: string    = text_raw;
      let type: MessageType = 'chat';
      const match = text_raw.match(/^ql:(\w+):([\s\S]*)$/);
      if (match) {
        type = match[1] as MessageType;
        text = match[2];
      }

      return {
        id:        `${fromRadio.id}-${packet.from}`,
        text,
        type,
        fromId:    packet.from.toString(16),
        fromSelf,
        timestamp: Date.now(),
        hops:      7 - (packet.hopLimit ?? 7),
        channel:   'lora',
      };
    } catch {
      return null;
    }
  }
}

function stringToNodeId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = (Math.imul(h, 0x01000193) >>> 0);
  }
  return h >>> 0;
}
