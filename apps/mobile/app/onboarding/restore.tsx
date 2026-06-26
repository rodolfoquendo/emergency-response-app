import { useState } from 'react';
import { ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { YStack, H2, Paragraph, Button, Text, Input, XStack, Label } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { isValidSeedPhrase } from '@quakelink/crypto';
import { useIdentity } from '@quakelink/identity';

export default function RestoreScreen() {
  const router = useRouter();
  const { createIdentity } = useIdentity();

  const [words, setWords]   = useState<string[]>(Array(12).fill(''));
  const [alias, setAlias]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const phrase    = words.join(' ');
  const isValid   = isValidSeedPhrase(phrase);
  const canSubmit = isValid && alias.trim().length >= 2;

  const updateWord = (index: number, value: string) => {
    // Handle paste of full phrase into first box
    const trimmed = value.trim();
    const parts   = trimmed.split(/\s+/);
    if (parts.length === 12 && index === 0) {
      setWords(parts.map((w) => w.toLowerCase()));
      return;
    }
    setWords((prev) => {
      const next = [...prev];
      next[index] = value.toLowerCase().trim();
      return next;
    });
  };

  const handleRestore = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await createIdentity(alias.trim(), phrase);
      router.replace('/(tabs)/');
    } catch (e) {
      setError('Could not restore identity. Check your seed phrase.');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <YStack flex={1} padding="$5" gap="$4">
            <YStack gap="$2">
              <H2 color="$color" fontWeight="800">Restore Identity</H2>
              <Paragraph color="$colorSubtle" fontSize="$3">
                Enter your 12-word seed phrase. You can also paste the full phrase into the first box.
              </Paragraph>
            </YStack>

            <XStack flexWrap="wrap" gap="$2">
              {words.map((word, i) => (
                <YStack key={i} width="30%">
                  <Text color="$colorSubtle" fontSize="$1" marginBottom="$1">{i + 1}</Text>
                  <Input
                    value={word}
                    onChangeText={(val) => updateWord(i, val)}
                    placeholder={`word ${i + 1}`}
                    placeholderTextColor="#444"
                    backgroundColor="$backgroundPress"
                    color="$color"
                    borderColor="$borderColor"
                    fontSize="$3"
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </YStack>
              ))}
            </XStack>

            {words.every((w) => w.length > 0) && !isValid && (
              <Text color="$red10" fontSize="$2">
                Invalid seed phrase. Check your words and try again.
              </Text>
            )}

            {isValid && (
              <Text color="$green10" fontSize="$2">✓ Valid seed phrase</Text>
            )}

            <YStack gap="$2">
              <Label color="$colorSubtle" fontSize="$2">YOUR NAME</Label>
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

            {error ? <Text color="$red10" fontSize="$2">{error}</Text> : null}

            <Button
              size="$5"
              theme="red"
              disabled={!canSubmit || saving}
              opacity={canSubmit && !saving ? 1 : 0.4}
              onPress={handleRestore}
              fontWeight="700"
              marginTop="$2"
            >
              {saving ? 'Restoring…' : 'Restore Identity'}
            </Button>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
