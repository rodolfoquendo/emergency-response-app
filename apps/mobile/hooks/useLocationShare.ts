import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import type { SendPayload } from '@quakelink/mesh';
import type { StoredContact } from '@quakelink/identity';

export type LocationTarget = 'all' | StoredContact[];

export type LocationShareResult = 'ok' | 'permission_denied' | 'error';

export function useLocationShare(sendMessage: (payload: SendPayload) => Promise<void>) {
  const [isSending, setIsSending] = useState(false);

  const shareLocation = useCallback(
    async (target: LocationTarget = 'all'): Promise<LocationShareResult> => {
      setIsSending(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return 'permission_denied';

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const payload = {
          lat: parseFloat(loc.coords.latitude.toFixed(5)),
          lon: parseFloat(loc.coords.longitude.toFixed(5)),
          accuracy: Math.round(loc.coords.accuracy ?? 0),
          to: target === 'all' ? 'all' : (target as StoredContact[]).map((c) => c.signPublicKey),
        };

        await sendMessage({ text: JSON.stringify(payload), type: 'location' });
        return 'ok';
      } catch {
        return 'error';
      } finally {
        setIsSending(false);
      }
    },
    [sendMessage],
  );

  return { shareLocation, isSending };
}
