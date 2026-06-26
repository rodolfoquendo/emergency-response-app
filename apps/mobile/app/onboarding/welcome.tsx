import { YStack, H1, Paragraph, Button, Text } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <YStack flex={1} padding="$6" justifyContent="space-between">
        <YStack flex={1} justifyContent="center" gap="$4">
          <Text fontSize={56} textAlign="center">🌍</Text>
          <H1 color="$color" textAlign="center" fontWeight="800">
            QuakeLink
          </H1>
          <Paragraph color="$colorSubtle" textAlign="center" fontSize="$5" lineHeight="$7">
            Seismic detection and emergency messaging — no signal required.
          </Paragraph>
          <Paragraph color="$colorSubtle" textAlign="center" fontSize="$3">
            Your identity is a 12-word phrase stored only on your device.{'\n'}No accounts. No servers.
          </Paragraph>
        </YStack>

        <YStack gap="$3">
          <Button
            size="$5"
            theme="red"
            onPress={() => router.push('/onboarding/generate')}
            fontWeight="700"
          >
            Create New Identity
          </Button>
          <Button
            size="$5"
            variant="outlined"
            borderColor="$borderColor"
            color="$color"
            onPress={() => router.push('/onboarding/restore')}
          >
            Restore with Seed Phrase
          </Button>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
