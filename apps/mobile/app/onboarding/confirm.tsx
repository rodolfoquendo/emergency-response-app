import { useState, useMemo } from 'react';
import { YStack, H2, Paragraph, Button, Text, Input, XStack } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { splitPhrase } from '@quakelink/crypto';
import { useIdentity } from '@quakelink/identity';

function pickVerifyIndices(words: string[]): number[] {
  const indices = new Set<number>();
  while (indices.size < 3) {
    indices.add(Math.floor(Math.random() * words.length));
  }
  return Array.from(indices).sort((a, b) => a - b);
}

export default function ConfirmScreen() {
  const router  = useRouter();
  const { phrase, alias } = useLocalSearchParams<{ phrase: string; alias: string }>();
  const { createIdentity } = useIdentity();

  const words   = useMemo(() => splitPhrase(phrase ?? ''), [phrase]);
  const indices = useMemo(() => pickVerifyIndices(words), [words]);

  const [answers, setAnswers]   = useState<Record<number, string>>({});
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  const allCorrect = indices.every(
    (i) => (answers[i] ?? '').trim().toLowerCase() === words[i],
  );

  const handleConfirm = async () => {
    if (!allCorrect || !phrase || !alias) return;
    setSaving(true);
    setError('');
    try {
      await createIdentity(alias, phrase);
      router.replace('/(tabs)/');
    } catch (e) {
      setError('Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <YStack flex={1} padding="$5" gap="$5">
        <YStack gap="$2">
          <H2 color="$color" fontWeight="800">Verify Your Backup</H2>
          <Paragraph color="$colorSubtle" fontSize="$3">
            Enter the missing words from your seed phrase to confirm you've written them down.
          </Paragraph>
        </YStack>

        <YStack gap="$4">
          {indices.map((wordIndex) => (
            <YStack key={wordIndex} gap="$1">
              <Text color="$colorSubtle" fontSize="$2">Word #{wordIndex + 1}</Text>
              <Input
                value={answers[wordIndex] ?? ''}
                onChangeText={(val) =>
                  setAnswers((prev) => ({ ...prev, [wordIndex]: val }))
                }
                placeholder={`word ${wordIndex + 1}`}
                placeholderTextColor="#555"
                backgroundColor="$backgroundPress"
                color="$color"
                borderColor={
                  answers[wordIndex] !== undefined
                    ? (answers[wordIndex] ?? '').trim().toLowerCase() === words[wordIndex]
                      ? '$green8'
                      : '$red8'
                    : '$borderColor'
                }
                autoCapitalize="none"
                autoCorrect={false}
              />
            </YStack>
          ))}
        </YStack>

        {error ? (
          <Text color="$red10" fontSize="$2">{error}</Text>
        ) : null}

        <Button
          size="$5"
          theme="red"
          disabled={!allCorrect || saving}
          opacity={allCorrect && !saving ? 1 : 0.4}
          onPress={handleConfirm}
          fontWeight="700"
          marginTop="auto"
        >
          {saving ? 'Creating Identity…' : 'Confirm & Enter QuakeLink'}
        </Button>
      </YStack>
    </SafeAreaView>
  );
}
