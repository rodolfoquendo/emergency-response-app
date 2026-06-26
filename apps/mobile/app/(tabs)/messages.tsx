import { useState, useCallback } from 'react';
import { FlatList } from 'react-native';
import { YStack, XStack, Input, Button, Text, H3 } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageBubble } from '@quakelink/ui';
import { useMesh, type MeshMessage } from '@quakelink/mesh';

export default function MessagesScreen() {
  const { messages, sendMessage, peers, isConnected } = useMesh();
  const [draft, setDraft] = useState('');

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    sendMessage({ text, type: 'chat' });
    setDraft('');
  }, [draft, sendMessage]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <YStack flex={1} padding="$4" gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <H3 color="$color">Mesh Messages</H3>
          <YStack alignItems="flex-end">
            <Text color="$colorSubtle" fontSize="$1">{peers} peer{peers !== 1 ? 's' : ''} nearby</Text>
            <Text color={isConnected ? '$green10' : '$red10'} fontSize="$2">
              {isConnected ? 'Mesh Active' : 'No Signal'}
            </Text>
          </YStack>
        </XStack>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          style={{ flex: 1 }}
          inverted
          contentContainerStyle={{ paddingVertical: 8 }}
        />

        <XStack gap="$2">
          <Input
            flex={1}
            value={draft}
            onChangeText={setDraft}
            placeholder="Emergency message…"
            placeholderTextColor="#555"
            backgroundColor="$backgroundPress"
            color="$color"
            borderColor="$borderColor"
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Button onPress={handleSend} disabled={!draft.trim()} theme="red">
            Send
          </Button>
        </XStack>
      </YStack>
    </SafeAreaView>
  );
}
