import { useState, useCallback, useMemo } from 'react';
import { FlatList, TouchableOpacity } from 'react-native';
import { YStack, XStack, Input, Button, Text, H3 } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageBubble } from '@quakelink/ui';
import { useIdentity } from '@quakelink/identity';
import type { SendPayload } from '@quakelink/mesh';
import { useDirectBle, MESH_CONVO, type ChatMessage } from '../../hooks/DirectBleProvider';
import { LocationShareSheet } from '../../components/LocationShareSheet';
import { RequestProofSheet } from '../../components/RequestProofSheet';
import { ProofRequestBanner } from '../../components/ProofRequestBanner';
import { useProofOfLiving } from '../../hooks/useProofOfLiving';
import type { StoredContact } from '@quakelink/identity';

function previewText(m: ChatMessage | undefined): string {
  if (!m) return '';
  switch (m.type) {
    case 'location': return '📍 Location';
    case 'proof_request': return '📟 Proof of living request';
    case 'proof_response': return '✅ Alive confirmed';
    default: return m.text;
  }
}

export default function MessagesScreen() {
  const { messages, peers, peerCount, isConnected, send } = useDirectBle();
  const { identity, contacts } = useIdentity();

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [proofSheetOpen, setProofSheetOpen] = useState(false);

  const meshSend = useCallback((p: SendPayload) => send(p), [send]);

  const {
    confirmAliveAndRespond,
    requestProof,
    pendingRequests,
    cacheValid,
    provenAt,
  } = useProofOfLiving({ sendMessage: meshSend, messages, myIdentity: identity });

  const onlineKeys = useMemo(
    () => new Set(peers.map((p) => p.signPublicKey)),
    [peers],
  );

  // Latest message per conversation (messages are stored newest-first).
  const lastByConvo = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of messages) {
      if (m.type === 'seismic') continue;
      if (!map.has(m.convo)) map.set(m.convo, m);
    }
    return map;
  }, [messages]);

  const conversations = useMemo(() => {
    const items: Array<{ key: string; title: string; subtitle: string; online: boolean; ts: number }> = [];
    const mesh = lastByConvo.get(MESH_CONVO);
    items.push({
      key: MESH_CONVO,
      title: '🌐 Mesh chat',
      subtitle: mesh ? previewText(mesh) : 'Everyone nearby',
      online: peerCount > 0,
      ts: mesh?.timestamp ?? 0,
    });
    for (const c of contacts) {
      const last = lastByConvo.get(c.signPublicKey);
      items.push({
        key: c.signPublicKey,
        title: c.alias,
        subtitle: last ? previewText(last) : 'Tap to chat',
        online: onlineKeys.has(c.signPublicKey),
        ts: last?.timestamp ?? 0,
      });
    }
    // Conversations from non-contacts who messaged us.
    for (const [key, last] of lastByConvo) {
      if (key === MESH_CONVO || contacts.some((c) => c.signPublicKey === key)) continue;
      items.push({
        key,
        title: peers.find((p) => p.signPublicKey === key)?.alias || 'Unknown device',
        subtitle: previewText(last),
        online: onlineKeys.has(key),
        ts: last.timestamp,
      });
    }
    return items.sort((a, b) => (a.key === MESH_CONVO ? -1 : b.key === MESH_CONVO ? 1 : b.ts - a.ts));
  }, [contacts, lastByConvo, onlineKeys, peerCount, peers]);

  const convoMessages = useMemo(
    () =>
      messages
        .filter((m) => m.convo === selected && m.type !== 'seismic')
        .sort((a, b) => b.timestamp - a.timestamp),
    [messages, selected],
  );

  const isMesh = selected === MESH_CONVO;
  const selectedTitle = useMemo(() => {
    if (!selected) return '';
    if (isMesh) return '🌐 Mesh chat';
    return contacts.find((c) => c.signPublicKey === selected)?.alias
      ?? peers.find((p) => p.signPublicKey === selected)?.alias
      ?? 'Conversation';
  }, [selected, isMesh, contacts, peers]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || !selected) return;
    send({ text, type: 'chat' }, isMesh ? undefined : selected);
    setDraft('');
  }, [draft, selected, isMesh, send]);

  const handleRequestProof = useCallback(async (contact: StoredContact) => {
    await requestProof(contact, identity?.alias ?? 'Unknown');
  }, [requestProof, identity]);

  // ── Conversation list ───────────────────────────────────────────────────────
  if (!selected) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
        <YStack flex={1} padding="$4" gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <H3 color="$color">Chats</H3>
            <Text color={isConnected ? '$green10' : '$red10'} fontSize="$2">
              {peerCount} nearby
            </Text>
          </XStack>

          <FlatList
            data={conversations}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => setSelected(item.key)}>
                <XStack
                  backgroundColor="$backgroundPress"
                  borderRadius="$4"
                  padding="$3"
                  marginBottom="$2"
                  alignItems="center"
                  gap="$3"
                >
                  <YStack flex={1}>
                    <XStack alignItems="center" gap="$2">
                      <Text color="$color" fontWeight="700">{item.title}</Text>
                      {item.online && (
                        <YStack width={8} height={8} borderRadius={4} backgroundColor="$green10" />
                      )}
                    </XStack>
                    <Text color="$colorSubtle" fontSize="$2" numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  </YStack>
                  <Text color="$colorSubtle" fontSize="$6">›</Text>
                </XStack>
              </TouchableOpacity>
            )}
          />
        </YStack>
      </SafeAreaView>
    );
  }

  // ── Single conversation ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <YStack flex={1} padding="$4" gap="$3">
        <XStack alignItems="center" gap="$2">
          <TouchableOpacity onPress={() => { setSelected(null); setDraft(''); }}>
            <Text color="$blue10" fontSize="$5">‹ Chats</Text>
          </TouchableOpacity>
          <YStack flex={1} alignItems="center">
            <Text color="$color" fontWeight="700">{selectedTitle}</Text>
            {!isMesh && (
              <Text color="$colorSubtle" fontSize="$1">
                {onlineKeys.has(selected) ? 'Online · encrypted' : 'Offline · encrypted'}
              </Text>
            )}
          </YStack>
          <Text fontSize="$5" opacity={0}>‹</Text>
        </XStack>

        {isMesh && (
          <>
            <ProofRequestBanner requests={pendingRequests} onConfirm={confirmAliveAndRespond} />
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
            <XStack gap="$2">
              <Button flex={1} onPress={() => setLocationSheetOpen(true)} backgroundColor="$red10" size="$3" borderRadius="$4">
                <Text color="white" fontWeight="700" fontSize="$2">📍 SHARE LOCATION</Text>
              </Button>
              <Button flex={1} onPress={() => setProofSheetOpen(true)} backgroundColor="#78350f" borderColor="#f59e0b" borderWidth={1} size="$3" borderRadius="$4">
                <Text color="#fef3c7" fontWeight="700" fontSize="$2">📟 PROOF OF LIVING</Text>
              </Button>
            </XStack>
          </>
        )}

        <FlatList
          data={convoMessages}
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
            placeholder={isMesh ? 'Message everyone…' : 'Encrypted message…'}
            placeholderTextColor="#555"
            backgroundColor="$backgroundPress"
            color="$color"
            borderColor="$borderColor"
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Button onPress={handleSend} disabled={!draft.trim()} theme="red">Send</Button>
        </XStack>
      </YStack>

      <LocationShareSheet
        visible={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
        sendMessage={meshSend}
      />

      <RequestProofSheet
        visible={proofSheetOpen}
        onClose={() => setProofSheetOpen(false)}
        onRequest={handleRequestProof}
      />
    </SafeAreaView>
  );
}
