import type { EventSubscription } from 'expo-modules-core';

import BleDirect from './src/BleDirectModule';
import type { BleDirectMessageEvent, BleDirectPeersEvent } from './src/BleDirect.types';

export * from './src/BleDirect.types';

export function start(displayName: string): Promise<void> {
  return BleDirect.start(displayName);
}

export function stop(): Promise<void> {
  return BleDirect.stop();
}

export function send(text: string): Promise<void> {
  return BleDirect.send(text);
}

export function isSupported(): boolean {
  return BleDirect.isSupported();
}

export function addMessageListener(
  listener: (event: BleDirectMessageEvent) => void,
): EventSubscription {
  return BleDirect.addListener('onMessage', listener);
}

export function addPeersListener(
  listener: (event: BleDirectPeersEvent) => void,
): EventSubscription {
  return BleDirect.addListener('onPeersChanged', listener);
}
