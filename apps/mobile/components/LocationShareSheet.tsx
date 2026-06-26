import { useState, useCallback } from 'react';
import {
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { YStack, XStack, Text, Button } from 'tamagui';
import { useIdentity } from '@quakelink/identity';
import { useLocationShare, type LocationTarget } from '../hooks/useLocationShare';
import type { SendPayload } from '@quakelink/mesh';
import type { StoredContact } from '@quakelink/identity';

type Mode = 'all' | 'favorites' | 'selected';

type Props = {
  visible: boolean;
  onClose: () => void;
  sendMessage: (payload: SendPayload) => Promise<void>;
};

export function LocationShareSheet({ visible, onClose, sendMessage }: Props) {
  const { contacts, toggleFavorite } = useIdentity();
  const { shareLocation, isSending } = useLocationShare(sendMessage);
  const [mode, setMode] = useState<Mode>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const favorites = contacts.filter((c) => c.favorite);

  const toggleSelected = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleSend = useCallback(async () => {
    let target: LocationTarget;

    if (mode === 'all') {
      target = 'all';
    } else if (mode === 'favorites') {
      if (favorites.length === 0) {
        Alert.alert('No favorites', 'Star at least one contact first.');
        return;
      }
      target = favorites;
    } else {
      const picks = contacts.filter((c) => selected.has(c.signPublicKey));
      if (picks.length === 0) {
        Alert.alert('No contacts selected', 'Select at least one contact.');
        return;
      }
      target = picks;
    }

    const result = await shareLocation(target);

    if (result === 'permission_denied') {
      Alert.alert('Permission denied', 'Enable location access in Settings.');
      return;
    }
    if (result === 'error') {
      Alert.alert('Could not get location', 'Make sure GPS is enabled and try again.');
      return;
    }

    onClose();
  }, [mode, favorites, contacts, selected, shareLocation, onClose]);

  const recipientLabel =
    mode === 'all'       ? `All contacts (${contacts.length})`       :
    mode === 'favorites' ? `Favorites (${favorites.length})`          :
                           `${selected.size} selected`;

  const canSend =
    mode === 'all'       ? true                  :
    mode === 'favorites' ? favorites.length > 0  :
                           selected.size > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

      <YStack style={s.sheet} backgroundColor="$background" gap="$4" padding="$5">

        {/* Header */}
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$6" fontWeight="700" color="$color">Share Location</Text>
          <TouchableOpacity onPress={onClose}>
            <Text color="$colorSubtle" fontSize="$4">✕</Text>
          </TouchableOpacity>
        </XStack>

        {/* Mode selector */}
        <XStack gap="$2">
          {(['all', 'favorites', 'selected'] as Mode[]).map((m) => (
            <TouchableOpacity key={m} style={{ flex: 1 }} onPress={() => setMode(m)}>
              <YStack
                backgroundColor={mode === m ? '#ef4444' : '$backgroundPress'}
                borderRadius="$3"
                paddingVertical="$2"
                alignItems="center"
              >
                <Text
                  color={mode === m ? 'white' : '$colorSubtle'}
                  fontSize="$2"
                  fontWeight={mode === m ? '700' : '400'}
                >
                  {m === 'all' ? 'All' : m === 'favorites' ? '⭐ Favorites' : 'Select'}
                </Text>
              </YStack>
            </TouchableOpacity>
          ))}
        </XStack>

        {/* Recipient summary */}
        <Text color="$colorSubtle" fontSize="$2">{recipientLabel}</Text>

        {/* Contact list — shown for favorites and selected modes */}
        {mode !== 'all' && (
          <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
            <YStack gap="$2">
              {contacts.length === 0 ? (
                <Text color="$colorSubtle" fontSize="$3">No contacts saved yet.</Text>
              ) : (
                contacts.map((c) => {
                  const isChecked = mode === 'selected'
                    ? selected.has(c.signPublicKey)
                    : c.favorite;

                  return (
                    <XStack
                      key={c.signPublicKey}
                      alignItems="center"
                      gap="$3"
                      backgroundColor={isChecked ? '#ef444422' : '$backgroundPress'}
                      borderRadius="$3"
                      padding="$3"
                      borderWidth={1}
                      borderColor={isChecked ? '#ef4444' : 'transparent'}
                    >
                      {/* Checkbox (only in selected mode) */}
                      {mode === 'selected' && (
                        <TouchableOpacity onPress={() => toggleSelected(c.signPublicKey)}>
                          <Text fontSize="$4">{isChecked ? '✓' : '○'}</Text>
                        </TouchableOpacity>
                      )}

                      {/* Contact name */}
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => mode === 'selected' && toggleSelected(c.signPublicKey)}
                      >
                        <Text color="$color" fontSize="$3" fontWeight="500">{c.alias}</Text>
                      </TouchableOpacity>

                      {/* Favorite star (always visible in contact list) */}
                      <TouchableOpacity onPress={() => toggleFavorite(c.signPublicKey)}>
                        <Text fontSize="$4">{c.favorite ? '⭐' : '☆'}</Text>
                      </TouchableOpacity>
                    </XStack>
                  );
                })
              )}
            </YStack>
          </ScrollView>
        )}

        {/* Send button */}
        <Button
          onPress={handleSend}
          disabled={isSending || !canSend}
          backgroundColor="$red10"
          pressStyle={{ opacity: 0.8 }}
          size="$5"
          borderRadius="$4"
        >
          <Text color="white" fontWeight="700" fontSize="$4">
            {isSending ? 'Getting location…' : '📍 SEND MY LOCATION'}
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
