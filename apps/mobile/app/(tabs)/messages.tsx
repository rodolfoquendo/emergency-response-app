import { useState, useCallback } from 'react';
import { FlatList } from 'react-native';
import { YStack, XStack, Input, Button, Text, H3 } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageBubble } from '@quakelink/ui';
import { useMesh } from '@quakelink/mesh';
import { useIdentity } from '@quakelink/identity';
import { LocationShareSheet } from '../../components/LocationShareSheet';
import { RequestProofSheet } from '../../components/RequestProofSheet';
import { ProofRequestBanner } from '../../components/ProofRequestBanner';
import { useProofOfLiving } from '../../hooks/useProofOfLiving';
import type { StoredContact } from '@quakelink/identity';

export default function MessagesScreen() {
  const { messages, sendMessage, peers, isConnected } = useMesh();
  const { identity } = useIdentity();
  const [draft, setDraft] = useState('');
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [proofSheetOpen, setProofSheetOpen] = useState(false);

  const {
    confirmAliveAndRespond,
    requestProof,
    pendingRequests,
    cacheValid,
    provenAt,
  } = useProofOfLiving({ sendMessage, messages, myIdentity: identity });

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    sendMessage({ text, type: 'chat' });
    setDraft('');
  }, [draft, sendMessage]);

  const handleRequestProof = useCallback(async (contact: StoredContact) => {
    await requestProof(contact, identity?.alias ?? 'Unknown');
  }, [requestProof, identity]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <YStack flex={1} padding="$4" gap="$3">

        {/* Header */}
        <XStack justifyContent="space-between" alignItems="center">
          <H3 color="$color">Mesh Messages</H3>
          <YStack alignItems="flex-end">
            <Text color="$colorSubtle" fontSize="$1">{peers} peer{peers !== 1 ? 's' : ''} nearby</Text>
            <Text color={isConnected ? '$green10' : '$red10'} fontSize="$2">
              {isConnected ? 'Mesh Active' : 'No Signal'}
            </Text>
          </YStack>
        </XStack>

        {/* Pending proof-of-living requests banner */}
        <ProofRequestBanner
          requests={pendingRequests}
          onConfirm={confirmAliveAndRespond}
        />

        {/* Cache status — shown only when active */}
        {cacheValid && provenAt !== null && (
          <XStack
            backgroundColor="#14532d"
            borderColor="#22c55e"
            borderWidth={1}
            borderRadius="$3"
            padding="$2"
            paddingHorizontal="$3"
            alignItems="center"
            gap="$2"
          >
            <Text fontSize="$3">✅</Text>
            <Text color="#bbf7d0" fontSize="$1">
              Alive confirmed at{' '}
              {new Date(provenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
              Auto-responding for 1 h.
            </Text>
          </XStack>
        )}

        {/* Emergency action buttons */}
        <XStack gap="$2">
          <Button
            flex={1}
            onPress={() => setLocationSheetOpen(true)}
            backgroundColor="$red10"
            pressStyle={{ opacity: 0.8 }}
            size="$4"
            borderRadius="$4"
          >
            <Text color="white" fontWeight="700" fontSize="$2">📍 SHARE LOCATION</Text>
          </Button>
          <Button
            flex={1}
            onPress={() => setProofSheetOpen(true)}
            backgroundColor="#78350f"
            borderColor="#f59e0b"
            borderWidth={1}
            pressStyle={{ opacity: 0.8 }}
            size="$4"
            borderRadius="$4"
          >
            <Text color="#fef3c7" fontWeight="700" fontSize="$2">📟 PROOF OF LIVING</Text>
          </Button>
        </XStack>

        {/* Message list */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          style={{ flex: 1 }}
          inverted
          contentContainerStyle={{ paddingVertical: 8 }}
        />

        {/* Chat input */}
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

      <LocationShareSheet
        visible={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
        sendMessage={sendMessage}
      />

      <RequestProofSheet
        visible={proofSheetOpen}
        onClose={() => setProofSheetOpen(false)}
        onRequest={handleRequestProof}
      />
    </SafeAreaView>
  );
}
