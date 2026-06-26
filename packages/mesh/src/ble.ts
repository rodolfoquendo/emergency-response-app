import { BleManager, type Device } from 'react-native-ble-plx';
import { create, toBinary, fromBinary } from '@bufbuild/protobuf';
import {
  MeshPacketSchema,
  DataSchema,
  FromRadioSchema,
  ToRadioSchema,
} from '@meshtastic/protobufs/lib/mesh_pb.js';
import { PortNum } from '@meshtastic/protobufs/lib/portnums_pb.js';
import type { MeshMessage, SendPayload, MessageType } from './types';

// Official Meshtastic BLE GATT UUIDs — hardcoded by the Meshtastic firmware.
// TORADIO: write packets to the device (phone → radio).
// FROMRADIO: read packets from the device (radio → phone).
// FROMNUM: notify-only; signals that a new packet is waiting on FROMRADIO.
// Source: https://meshtastic.org/docs/development/device/ble-api/
const MESHTASTIC_SERVICE = '6ba1b218-15a8-461f-9fa8-5d6646b9ac5d';
const TORADIO_CHAR       = 'f75c76d2-129e-4dad-a1dd-7866124401e7';
const FROMRADIO_CHAR     = '8ba2bcc2-ee02-4a55-a531-c525c5e454d5';
const FROMNUM_CHAR       = 'ed9da18c-a800-4f66-a670-aa7547e34453';

const BROADCAST_ADDR = 0xffffffff; // Meshtastic "send to all on channel" address

// Map our internal message types to Meshtastic PortNums.
// TEXT_MESSAGE_APP is the standard port all Meshtastic clients display.
// We embed our own type tag in the payload text so QuakeLink nodes can
// distinguish chat from seismic/alert/location, while plain Meshtastic
// clients still see the raw text.
function portNumForType(type: MessageType): PortNum {
  return PortNum.TEXT_MESSAGE_APP;
}

export class BleTransport {
  private manager = new BleManager();
  private connectedDevice: Device | null = null;
  private nodeId: string;
  // Numeric node ID derived from the string nodeId for the protobuf `from` field.
  private numericId: number;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    // Stable 32-bit numeric ID from the string nodeId.
    this.numericId = stringToNodeId(nodeId);
  }

  async scan(onPeer: (deviceId: string, rssi: number) => void): Promise<void> {
    this.manager.startDeviceScan([MESHTASTIC_SERVICE], null, (error, device) => {
      if (error || !device) return;
      onPeer(device.id, device.rssi ?? -100);
    });
  }

  stopScan() {
    this.manager.stopDeviceScan();
  }

  async connect(deviceId: string): Promise<void> {
    const device = await this.manager.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();
    this.connectedDevice = device;
  }

  async send(payload: SendPayload): Promise<void> {
    if (!this.connectedDevice) throw new Error('No BLE device connected');

    const meshPacket = create(MeshPacketSchema, {
      from: this.numericId,
      to: BROADCAST_ADDR,
      channel: 0,
      hopLimit: 7,
      wantAck: false,
      payloadVariant: {
        case: 'decoded',
        value: create(DataSchema, {
          portnum: portNumForType(payload.type),
          // Prefix text with our type tag so QuakeLink receivers can parse it.
          // Plain Meshtastic clients see the full string; QuakeLink nodes strip the prefix.
          payload: new TextEncoder().encode(`ql:${payload.type}:${payload.text}`),
        }),
      },
    });

    const toRadio = create(ToRadioSchema, {
      payloadVariant: { case: 'packet', value: meshPacket },
    });

    const bytes = toBinary(ToRadioSchema, toRadio);
    const b64   = Buffer.from(bytes).toString('base64');

    await this.connectedDevice.writeCharacteristicWithResponseForService(
      MESHTASTIC_SERVICE,
      TORADIO_CHAR,
      b64,
    );
  }

  onReceive(callback: (msg: MeshMessage) => void): void {
    if (!this.connectedDevice) return;

    // FROMNUM notifies when a packet is ready; we then read FROMRADIO.
    // Keep reading until we get an empty response (end of queue).
    this.connectedDevice.monitorCharacteristicForService(
      MESHTASTIC_SERVICE,
      FROMNUM_CHAR,
      async () => {
        if (!this.connectedDevice) return;
        await this.drainFromRadio(callback);
      },
    );
  }

  private async drainFromRadio(callback: (msg: MeshMessage) => void): Promise<void> {
    if (!this.connectedDevice) return;

    while (true) {
      const char = await this.connectedDevice
        .readCharacteristicForService(MESHTASTIC_SERVICE, FROMRADIO_CHAR)
        .catch(() => null);

      if (!char?.value) break; // null or empty = queue drained

      const bytes = Buffer.from(char.value, 'base64');
      if (bytes.length === 0) break;

      const msg = decodeFromRadio(bytes, this.nodeId);
      if (msg) callback(msg);
    }
  }

  destroy() {
    this.manager.destroy();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function decodeFromRadio(bytes: Buffer, ownNodeId: string): MeshMessage | null {
  try {
    const fromRadio = fromBinary(FromRadioSchema, new Uint8Array(bytes));
    if (fromRadio.payloadVariant.case !== 'packet') return null;

    const packet = fromRadio.payloadVariant.value;
    if (packet.payloadVariant.case !== 'decoded') return null;

    const data    = packet.payloadVariant.value;
    const raw     = new TextDecoder().decode(data.payload);
    const ownId   = stringToNodeId(ownNodeId);
    const fromSelf = packet.from === ownId;

    // Parse QuakeLink type tag if present, otherwise treat as plain chat.
    let text = raw;
    let type: MessageType = 'chat';
    const match = raw.match(/^ql:(\w+):([\s\S]*)$/);
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
      channel:   'ble',
    };
  } catch {
    return null;
  }
}

// Derive a stable 32-bit unsigned integer from a string node ID.
function stringToNodeId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = (Math.imul(h, 0x01000193) >>> 0);
  }
  return h >>> 0;
}
