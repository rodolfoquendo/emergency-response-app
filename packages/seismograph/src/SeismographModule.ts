import { requireNativeModule, EventEmitter } from 'expo-modules-core';
import type { SeismicReading, SeismographOptions } from './types';

type NativeSeismographModule = {
  startMonitoring(intervalMs: number): void;
  stopMonitoring(): void;
};

const native = requireNativeModule<NativeSeismographModule>('SeismographModule');
const emitter = new EventEmitter(native as any);

export const SeismographModule = {
  startMonitoring(options: SeismographOptions = {}) {
    native.startMonitoring(options.intervalMs ?? 50);
  },

  stopMonitoring() {
    native.stopMonitoring();
  },

  addReadingListener(callback: (reading: SeismicReading) => void) {
    return emitter.addListener<SeismicReading>('onReading', callback);
  },
};
