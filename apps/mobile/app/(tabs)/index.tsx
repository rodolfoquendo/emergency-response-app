import { useEffect, useCallback } from 'react';
import { YStack, XStack, Text, H2 } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SeismographChart, AlertBanner } from '@quakelink/ui';
import { useSeismograph } from '@quakelink/seismograph';
import { useMesh } from '@quakelink/mesh';
import { useConsensus, buildSeismicPayload } from '@quakelink/consensus';

const LOCAL_BROADCAST_THRESHOLD = 2.5;

export default function SeismographScreen() {
  const { readings, magnitude, isActive, start, stop } = useSeismograph();
  const { messages, sendMessage }                       = useMesh();

  const { alert, ingestLocalReading, ingestMeshMessage, dismissAlert } = useConsensus({
    nodeId:       'local',
    minNodes:     3,
    minMagnitude: 2.0,
  });

  // Start sensor on mount
  useEffect(() => {
    start();
    return () => stop();
  }, []);

  // Feed local readings into consensus engine; broadcast over mesh when strong enough
  useEffect(() => {
    if (readings.length === 0 || magnitude < LOCAL_BROADCAST_THRESHOLD) return;
    const latest = readings[readings.length - 1];
    ingestLocalReading(latest, magnitude);

    // Broadcast to mesh peers so they can vote too
    sendMessage({ text: buildSeismicPayload(magnitude), type: 'seismic' });
  }, [magnitude]);

  // Feed incoming mesh messages into consensus engine
  useEffect(() => {
    if (messages.length === 0) return;
    ingestMeshMessage(messages[0]); // messages[0] is most recent (list is inverted)
  }, [messages]);

  const confidenceColor = {
    low:    '$yellow10',
    medium: '$orange10',
    high:   '$red10',
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <YStack flex={1} padding="$4" gap="$4">
        <H2 color="$color" fontWeight="700">QuakeLink</H2>

        {alert && (
          <AlertBanner
            message={`M${alert.magnitude} confirmed by ${alert.confirmedBy} nodes (${alert.confidence} confidence)`}
            severity={alert.confidence === 'high' ? 'high' : alert.confidence === 'medium' ? 'medium' : 'low'}
          />
        )}

        <YStack flex={1} borderRadius="$4" backgroundColor="$background" padding="$3">
          <SeismographChart readings={readings} />
        </YStack>

        <XStack justifyContent="space-between" alignItems="center">
          <YStack>
            <Text color="$colorSubtle" fontSize="$2">Magnitude (est.)</Text>
            <Text
              color={magnitude >= 2.5 ? '$red10' : '$color'}
              fontSize="$8"
              fontWeight="800"
            >
              M{magnitude.toFixed(2)}
            </Text>
          </YStack>
          <YStack alignItems="flex-end">
            <Text color="$colorSubtle" fontSize="$2">Status</Text>
            <Text color={isActive ? '$green10' : '$colorSubtle'} fontSize="$4">
              {isActive ? 'Monitoring' : 'Idle'}
            </Text>
          </YStack>
        </XStack>

        {alert && (
          <XStack justifyContent="center">
            <Text
              color="$colorSubtle"
              fontSize="$2"
              onPress={dismissAlert}
              textDecorationLine="underline"
            >
              Dismiss alert
            </Text>
          </XStack>
        )}
      </YStack>
    </SafeAreaView>
  );
}
