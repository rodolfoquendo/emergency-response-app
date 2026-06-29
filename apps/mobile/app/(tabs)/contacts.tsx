import { useState, useMemo } from 'react';
import { ScrollView, Share } from 'react-native';
import { YStack, XStack, Text, Button, Input, H3, H4 } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIdentity } from '@quakelink/identity';
import { encodeContactLink, decodeContactLink, decodePublicBundle } from '@quakelink/crypto';
import { useDirectBle } from '../../hooks/DirectBleProvider';

export default function ContactsScreen() {
  const { identity, contacts, addContact, removeContact, toggleFavorite } = useIdentity();
  const { peers } = useDirectBle();

  const [linkInput, setLinkInput] = useState('');
  const [error, setError] = useState('');

  const contactKeys = useMemo(
    () => new Set(contacts.map((c) => c.signPublicKey)),
    [contacts],
  );

  // Nearby peers that aren't already saved as contacts.
  const nearby = useMemo(
    () => peers.filter((p) => !contactKeys.has(p.signPublicKey)),
    [peers, contactKeys],
  );

  const myLink = useMemo(() => {
    if (!identity) return '';
    return encodeContactLink(identity.alias, decodePublicBundle({
      signPublicKey: identity.signPublicKey,
      boxPublicKey: identity.boxPublicKey,
    }));
  }, [identity]);

  const addFromLink = () => {
    const card = decodeContactLink(linkInput.trim());
    if (!card) {
      setError('Invalid contact link.');
      return;
    }
    if (card.signPublicKey === identity?.signPublicKey) {
      setError("That's your own contact card.");
      return;
    }
    addContact({ ...card, favorite: false });
    setLinkInput('');
    setError('');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0f0f' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <YStack gap="$5">
          <H3 color="$color">Contacts</H3>

          {/* Nearby devices */}
          <YStack gap="$2">
            <H4 color="$color" fontSize="$4">Nearby devices</H4>
            {nearby.length === 0 ? (
              <Text color="$colorSubtle" fontSize="$2">No devices nearby. Open the app on another phone close by.</Text>
            ) : (
              nearby.map((p) => (
                <XStack
                  key={p.signPublicKey}
                  backgroundColor="$backgroundPress"
                  borderRadius="$4"
                  padding="$3"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <YStack flex={1}>
                    <Text color="$color" fontWeight="600">{p.alias || 'Unknown device'}</Text>
                    <Text color="$colorSubtle" fontSize="$1">{p.signPublicKey.slice(0, 16)}…</Text>
                  </YStack>
                  <Button
                    size="$3"
                    theme="green"
                    onPress={() =>
                      addContact({
                        alias: p.alias || 'Unknown',
                        signPublicKey: p.signPublicKey,
                        boxPublicKey: p.boxPublicKey,
                        favorite: false,
                      })
                    }
                  >
                    Add
                  </Button>
                </XStack>
              ))
            )}
          </YStack>

          {/* Saved contacts */}
          <YStack gap="$2">
            <H4 color="$color" fontSize="$4">My contacts ({contacts.length})</H4>
            {contacts.length === 0 ? (
              <Text color="$colorSubtle" fontSize="$2">No contacts yet.</Text>
            ) : (
              contacts.map((c) => (
                <XStack
                  key={c.signPublicKey}
                  backgroundColor="$backgroundPress"
                  borderRadius="$4"
                  padding="$3"
                  justifyContent="space-between"
                  alignItems="center"
                  gap="$2"
                >
                  <YStack flex={1}>
                    <Text color="$color" fontWeight="600">{c.alias}</Text>
                    <Text color="$colorSubtle" fontSize="$1">{c.signPublicKey.slice(0, 16)}…</Text>
                  </YStack>
                  <Text
                    fontSize="$5"
                    onPress={() => toggleFavorite(c.signPublicKey)}
                  >
                    {c.favorite ? '⭐️' : '☆'}
                  </Text>
                  <Button size="$3" theme="red" onPress={() => removeContact(c.signPublicKey)}>
                    Remove
                  </Button>
                </XStack>
              ))
            )}
          </YStack>

          {/* Add by link */}
          <YStack gap="$2">
            <H4 color="$color" fontSize="$4">Add by link</H4>
            <Input
              value={linkInput}
              onChangeText={(v) => { setLinkInput(v); setError(''); }}
              placeholder="Paste a quakelink://contact link"
              placeholderTextColor="#555"
              backgroundColor="$backgroundPress"
              color="$color"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {error ? <Text color="$red10" fontSize="$2">{error}</Text> : null}
            <Button theme="blue" onPress={addFromLink} disabled={!linkInput.trim()}>
              Add contact
            </Button>
          </YStack>

          {/* Share my contact */}
          <YStack gap="$2">
            <H4 color="$color" fontSize="$4">My contact card</H4>
            <Text color="$colorSubtle" fontSize="$1" selectable>{myLink}</Text>
            <Button
              theme="blue"
              onPress={() => Share.share({ message: myLink })}
              disabled={!myLink}
            >
              Share my contact
            </Button>
          </YStack>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
