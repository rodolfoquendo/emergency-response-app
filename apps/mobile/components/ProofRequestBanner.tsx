import { TouchableOpacity, StyleSheet } from 'react-native';
import { XStack, YStack, Text, Button } from 'tamagui';
import type { ProofRequest } from '../hooks/useProofOfLiving';

type Props = {
  requests: ProofRequest[];
  onConfirm: () => void;
};

export function ProofRequestBanner({ requests, onConfirm }: Props) {
  if (requests.length === 0) return null;

  const names = requests.map((r) => r.fromAlias).join(', ');
  const label = requests.length === 1
    ? `${requests[0].fromAlias} wants to know you're alive`
    : `${requests.length} contacts want to know you're alive (${names})`;

  return (
    <XStack
      backgroundColor="#78350f"
      borderColor="#f59e0b"
      borderWidth={1}
      borderRadius="$3"
      padding="$3"
      alignItems="center"
      gap="$3"
    >
      <Text fontSize="$4">⚠️</Text>
      <YStack flex={1} gap="$1">
        <Text color="#fef3c7" fontSize="$2" fontWeight="700">Proof of Living Request</Text>
        <Text color="#fde68a" fontSize="$1" numberOfLines={2}>{label}</Text>
      </YStack>
      <Button
        onPress={onConfirm}
        backgroundColor="#f59e0b"
        pressStyle={{ opacity: 0.8 }}
        size="$3"
        borderRadius="$3"
        paddingHorizontal="$3"
      >
        <Text color="#1c1917" fontWeight="700" fontSize="$2">I'm Alive</Text>
      </Button>
    </XStack>
  );
}
