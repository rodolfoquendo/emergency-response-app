import { useState, useCallback } from 'react';
import { Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { YStack, XStack, Text, Button } from 'tamagui';
import { useIdentity } from '@quakelink/identity';
import type { StoredContact } from '@quakelink/identity';

type Props = {
  visible: boolean;
  onClose: () => void;
  onRequest: (contact: StoredContact) => Promise<void>;
};

export function RequestProofSheet({ visible, onClose, onRequest }: Props) {
  const { contacts } = useIdentity();
  const [selected, setSelected] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSend = useCallback(async () => {
    const contact = contacts.find((c) => c.signPublicKey === selected);
    if (!contact) return;
    setIsSending(true);
    try {
      await onRequest(contact);
      setSelected(null);
      onClose();
    } finally {
      setIsSending(false);
    }
  }, [selected, contacts, onRequest, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

      <YStack style={s.sheet} backgroundColor="$background" gap="$4" padding="$5">
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$6" fontWeight="700" color="$color">Request Proof of Living</Text>
          <TouchableOpacity onPress={onClose}>
            <Text color="$colorSubtle" fontSize="$4">✕</Text>
          </TouchableOpacity>
        </XStack>

        <Text color="$colorSubtle" fontSize="$2">
          Select a contact to check if they're alive. They'll receive a request over the mesh and respond automatically if they've confirmed alive within the last hour.
        </Text>

        <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
          <YStack gap="$2">
            {contacts.length === 0 ? (
              <Text color="$colorSubtle" fontSize="$3">No contacts saved yet.</Text>
            ) : (
              contacts.map((c) => {
                const checked = selected === c.signPublicKey;
                return (
                  <TouchableOpacity key={c.signPublicKey} onPress={() => setSelected(c.signPublicKey)}>
                    <XStack
                      alignItems="center"
                      gap="$3"
                      backgroundColor={checked ? '#f59e0b22' : '$backgroundPress'}
                      borderRadius="$3"
                      padding="$3"
                      borderWidth={1}
                      borderColor={checked ? '#f59e0b' : 'transparent'}
                    >
                      <Text fontSize="$4">{checked ? '◉' : '○'}</Text>
                      <Text color="$color" fontSize="$3" fontWeight="500">{c.alias}</Text>
                    </XStack>
                  </TouchableOpacity>
                );
              })
            )}
          </YStack>
        </ScrollView>

        <Button
          onPress={handleSend}
          disabled={!selected || isSending}
          backgroundColor="#f59e0b"
          pressStyle={{ opacity: 0.8 }}
          size="$5"
          borderRadius="$4"
        >
          <Text color="#1c1917" fontWeight="700" fontSize="$4">
            {isSending ? 'Sending…' : '📟 SEND REQUEST'}
          </Text>
        </Button>
      </YStack>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000088' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
});
