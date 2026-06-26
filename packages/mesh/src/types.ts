export type MessageType = 'chat' | 'alert' | 'sos' | 'seismic';

export type MeshMessage = {
  id: string;
  text: string;
  type: MessageType;
  fromId: string;
  fromAlias?: string;
  fromSelf: boolean;
  timestamp: number;
  hops: number;
  channel: 'ble' | 'lora';
};

export type SendPayload = {
  text: string;
  type: MessageType;
};

export type MeshPeer = {
  id: string;
  alias?: string;
  rssi: number;
  channel: 'ble' | 'lora';
  lastSeen: number;
};
