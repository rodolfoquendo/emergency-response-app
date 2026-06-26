import { BleManager, type Device } from 'react-native-ble-plx';
import type { MeshMessage, SendPayload } from './types';

// Meshtastic BLE service/characteristic UUIDs
const MESHTASTIC_SERVICE = '6ba1b218-15a8-461f-9fa8-5d6646b9ac5d';
const TORADIO_CHAR = 'f75c76d2-129e-4dad-a1dd-7866124401e7';
const FROMRADIO_CHAR = '8ba2bcc2-ee02-4a55-a531-c525c5e454d5';
const FROMNUM_CHAR = 'ed9da18c-a800-4f66-a670-aa7547e34453';

export class BleTransport {
  private manager = new BleManager();
  private connectedDevice: Device | null = null;
  private nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
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
    const packet = encodePacket(payload, this.nodeId);
    await this.connectedDevice.writeCharacteristicWithResponseForService(
      MESHTASTIC_SERVICE,
      TORADIO_CHAR,
      btoa(String.fromCharCode(...packet)),
    );
  }

  onReceive(callback: (msg: MeshMessage) => void) {
    if (!this.connectedDevice) return;
    this.connectedDevice.monitorCharacteristicForService(
      MESHTASTIC_SERVICE,
      FROMRADIO_CHAR,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        const raw = Uint8Array.from(atob(characteristic.value), (c) => c.charCodeAt(0));
        const msg = decodePacket(raw, this.nodeId);
        if (msg) callback(msg);
      },
    );
  }

  destroy() {
    this.manager.destroy();
  }
}

function encodePacket(payload: SendPayload, fromId: string): Uint8Array {
  // Minimal protobuf-like encoding for Meshtastic MeshPacket
  // Production: use @meshtastic/js protobuf definitions
  const text = new TextEncoder().encode(payload.text);
  const header = new Uint8Array([0x01, payload.type === 'alert' ? 0x02 : 0x01]);
  const result = new Uint8Array(header.length + text.length);
  result.set(header);
  result.set(text, header.length);
  return result;
}

function decodePacket(raw: Uint8Array, ownId: string): MeshMessage | null {
  try {
    const typeCode = raw[1];
    const text = new TextDecoder().decode(raw.slice(2));
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      type: typeCode === 0x02 ? 'alert' : 'chat',
      fromId: 'unknown',
      fromSelf: false,
      timestamp: Date.now(),
      hops: 0,
      channel: 'ble',
    };
  } catch {
    return null;
  }
}
