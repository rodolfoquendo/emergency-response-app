import { useState, useEffect } from 'react';
import { ScrollView } from 'react-native';
import { YStack, XStack, H2, Paragraph, Button, Text, Input, Label } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { generateSeedPhrase, splitPhrase } from '@quakelink/crypto';

export default function GenerateScreen() {
  const router = useRouter();
  const [phrase, setPhrase]   = useState('');
  const [alias, setAlias]     = useState('');
  const [words, setWords]     = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const p = generateSeedPhrase();
    setPhrase(p);
    setWords(splitPhrase(p));
  }, []);

  const canContinue = revealed && alias.trim().length >= 2;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <YStack flex={1} padding="$5" gap="$5">
          <YStack gap="$2">
            <H2 color="$color" fontWeight="800">Your Seed Phrase</H2>
            <Paragraph color="$colorSubtle" fontSize="$3">
              These 12 words ARE your identity. Write them down on paper and store them safely.
              Anyone with these words can impersonate you.
            </Paragraph>
          </YStack>

          <YStack
            backgroundColor="$backgroundPress"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor={revealed ? '$borderColor' : '$red8'}
          >
            {revealed ? (
              <XStack flexWrap="wrap" gap="$2">
                {words.map((word, i) => (
                  <XStack
                    key={i}
                    backgroundColor="$background"
                    borderRadius="$2"
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    alignItems="center"
                    gap="$1"
                  >
                    <Text color="$colorSubtle" fontSize="$1">{i + 1}.</Text>
                    <Text color="$color" fontFamily="$mono" fontSize="$3">{word}</Text>
                  </XStack>
                ))}
              </XStack>
            ) : (
              <YStack alignItems="center" gap="$3" padding="$4">
                <Text fontSize={32}>🔒</Text>
                <Paragraph color="$colorSubtle" textAlign="center">
                  Tap to reveal your seed phrase.{'\n'}Make sure nobody is watching your screen.
                </Paragraph>
                <Button theme="red" onPress={() => setRevealed(true)}>
                  Reveal Seed Phrase
                </Button>
              </YStack>
            )}
          </YStack>

          {revealed && (
            <YStack
              backgroundColor="#ff1a1a11"
              borderRadius="$3"
              padding="$3"
              borderWidth={1}
              borderColor="$red8"
            >
              <Text color="$red10" fontSize="$2">
                ⚠ Write these words down NOW. You cannot recover your identity without them.
                Screenshots can be stolen. Paper cannot be hacked.
              </Text>
            </YStack>
          )}

          <YStack gap="$2">
            <Label color="$colorSubtle" fontSize="$2">YOUR NAME (visible to contacts)</Label>
            <Input
              value={alias}
              onChangeText={setAlias}
              placeholder="e.g. Maria"
              placeholderTextColor="#555"
              backgroundColor="$backgroundPress"
              color="$color"
              borderColor="$borderColor"
              maxLength={30}
            />
          </YStack>

          <Button
            size="$5"
            theme="red"
            disabled={!canContinue}
            opacity={canContinue ? 1 : 0.4}
            onPress={() =>
              router.push({
                pathname: '/onboarding/confirm',
                params: { phrase, alias: alias.trim() },
              })
            }
            fontWeight="700"
          >
            I've Written It Down →
          </Button>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
