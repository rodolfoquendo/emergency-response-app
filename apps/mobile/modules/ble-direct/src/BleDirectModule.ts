import { NativeModule, requireNativeModule } from 'expo';

import type { BleDirectEvents } from './BleDirect.types';

declare class BleDirectModule extends NativeModule<BleDirectEvents> {
  /** Begin advertising (peripheral) and scanning (central) for QuakeLink peers. */
  start(displayName: string): Promise<void>;
  /** Stop all BLE activity and disconnect peers. */
  stop(): Promise<void>;
  /** Broadcast a UTF-8 text payload to every connected peer. */
  send(text: string): Promise<void>;
  /** Whether this device can act as a BLE peripheral (advertise). */
  isSupported(): boolean;
}

export default requireNativeModule<BleDirectModule>('BleDirect');
