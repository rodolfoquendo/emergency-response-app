export type BleDirectMessageEvent = {
  /** Raw UTF-8 text received from a peer (QuakeLink `ql:type:text` framing). */
  text: string;
  /** Stable id of the sending device (platform BLE identifier). */
  fromId: string;
};

export type BleDirectPeersEvent = {
  /** Number of currently connected peers (central + peripheral links). */
  count: number;
};

export type BleDirectEvents = {
  onMessage: (event: BleDirectMessageEvent) => void;
  onPeersChanged: (event: BleDirectPeersEvent) => void;
};
