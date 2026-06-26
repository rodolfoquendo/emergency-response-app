import { YStack, XStack, Text, H3, Switch, Separator, Paragraph } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

export default function SettingsScreen() {
  const [bleEnabled, setBleEnabled] = useState(true);
  const [loraEnabled, setLoraEnabled] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [threshold, setThreshold] = useState(3.0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <YStack flex={1} padding="$4" gap="$4">
        <H3 color="$color">Settings</H3>

        <YStack gap="$3" backgroundColor="$background" borderRadius="$4" padding="$4">
          <Text color="$colorSubtle" fontSize="$2" textTransform="uppercase" letterSpacing={1}>
            Mesh Networking
          </Text>
          <XStack justifyContent="space-between" alignItems="center">
            <YStack>
              <Text color="$color">Bluetooth (BLE)</Text>
              <Paragraph color="$colorSubtle" fontSize="$2">Short-range mesh</Paragraph>
            </YStack>
            <Switch checked={bleEnabled} onCheckedChange={setBleEnabled} size="$3">
              <Switch.Thumb animation="quick" />
            </Switch>
          </XStack>
          <Separator />
          <XStack justifyContent="space-between" alignItems="center">
            <YStack>
              <Text color="$color">LoRa (Meshtastic)</Text>
              <Paragraph color="$colorSubtle" fontSize="$2">Long-range, requires device</Paragraph>
            </YStack>
            <Switch checked={loraEnabled} onCheckedChange={setLoraEnabled} size="$3">
              <Switch.Thumb animation="quick" />
            </Switch>
          </XStack>
        </YStack>

        <YStack gap="$3" backgroundColor="$background" borderRadius="$4" padding="$4">
          <Text color="$colorSubtle" fontSize="$2" textTransform="uppercase" letterSpacing={1}>
            Alerts
          </Text>
          <XStack justifyContent="space-between" alignItems="center">
            <YStack>
              <Text color="$color">Seismic Alerts</Text>
              <Paragraph color="$colorSubtle" fontSize="$2">
                Notify above M{threshold.toFixed(1)}
              </Paragraph>
            </YStack>
            <Switch checked={alertsEnabled} onCheckedChange={setAlertsEnabled} size="$3">
              <Switch.Thumb animation="quick" />
            </Switch>
          </XStack>
        </YStack>

        <YStack backgroundColor="$background" borderRadius="$4" padding="$4">
          <Text color="$colorSubtle" fontSize="$2" textTransform="uppercase" letterSpacing={1}>
            About
          </Text>
          <YStack marginTop="$3" gap="$1">
            <Text color="$color">QuakeLink v1.0.0</Text>
            <Paragraph color="$colorSubtle" fontSize="$2">
              Seismograph + offline mesh messaging for emergency preparedness.
            </Paragraph>
          </YStack>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
