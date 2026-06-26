import { TouchableOpacity, Linking, Platform } from 'react-native';
import { YStack, XStack, Text, Paragraph } from 'tamagui';
import type { MeshMessage } from '@quakelink/mesh';

type Props = {
  message: MeshMessage;
};

type LocationPayload = {
  lat: number;
  lon: number;
  accuracy: number;
  to: 'all' | string[];
};

function openInMaps(lat: number, lon: number) {
  const label = 'QuakeLink location';
  const url = Platform.select({
    ios: `maps://app?daddr=${lat},${lon}`,
    android: `geo:${lat},${lon}?q=${lat},${lon}(${label})`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
  });
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`)
  );
}

function ProofRequestBubbleContent({ text, fromSelf }: { text: string; fromSelf: boolean }) {
  try {
    const { fromAlias } = JSON.parse(text);
    return (
      <YStack gap="$1">
        <Text color="#f59e0b" fontWeight="700" fontSize="$3">📟 Proof of living request</Text>
        <Text color="$color" fontSize="$2">
          {fromSelf ? `You requested proof from ${fromAlias ?? 'a contact'}` : 'Wants to know you\'re alive'}
        </Text>
      </YStack>
    );
  } catch {
    return <Paragraph color="$color" fontSize="$3">{text}</Paragraph>;
  }
}

function ProofResponseBubbleContent({ text, fromSelf }: { text: string; fromSelf: boolean }) {
  try {
    const { provenAt, fromCache } = JSON.parse(text);
    const time = new Date(provenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = new Date(provenAt).toLocaleDateString();
    return (
      <YStack gap="$1">
        <Text color="#22c55e" fontWeight="700" fontSize="$3">✅ Alive confirmed</Text>
        <Text color="$color" fontSize="$2">Last confirmed: {date} at {time}</Text>
        {fromCache && (
          <Text color="$colorSubtle" fontSize="$1">Auto-responded from cache</Text>
        )}
      </YStack>
    );
  } catch {
    return <Paragraph color="$color" fontSize="$3">{text}</Paragraph>;
  }
}

function LocationBubble({ text }: { text: string }) {
  let payload: LocationPayload | null = null;
  try { payload = JSON.parse(text); } catch { /* fall through to raw text */ }

  if (!payload || typeof payload.lat !== 'number') {
    return <Paragraph color="$color" fontSize="$3">{text}</Paragraph>;
  }

  const { lat, lon, accuracy, to } = payload;
  const toLabel = to === 'all' ? 'all contacts' : `${(to as string[]).length} contact${(to as string[]).length !== 1 ? 's' : ''}`;

  return (
    <YStack gap="$2">
      <Text color="#ef4444" fontWeight="700" fontSize="$3">📍 Location shared</Text>
      <Text color="$color" fontSize="$2">
        {lat.toFixed(4)}, {lon.toFixed(4)}
      </Text>
      <Text color="$colorSubtle" fontSize="$1">±{accuracy} m · to {toLabel}</Text>
      <TouchableOpacity onPress={() => openInMaps(lat, lon)}>
        <Text
          color="#3b82f6"
          fontSize="$2"
          fontWeight="600"
          textDecorationLine="underline"
        >
          Open in Maps ↗
        </Text>
      </TouchableOpacity>
    </YStack>
  );
}

export function MessageBubble({ message }: Props) {
  const isMine = message.fromSelf;
  const isAlert = message.type === 'alert';
  const isLocation = message.type === 'location';
  const isProofRequest = message.type === 'proof_request';
  const isProofResponse = message.type === 'proof_response';

  return (
    <XStack
      justifyContent={isMine ? 'flex-end' : 'flex-start'}
      marginBottom="$2"
      paddingHorizontal="$1"
    >
      <YStack
        backgroundColor={
          isLocation      ? '#ef444422' :
          isProofRequest  ? '#f59e0b22' :
          isProofResponse ? '#22c55e22' :
          isAlert         ? '#ff1a1a22' :
          isMine          ? '$blue9'    :
                            '$backgroundPress'
        }
        borderColor={
          isLocation      ? '#ef4444' :
          isProofRequest  ? '#f59e0b' :
          isProofResponse ? '#22c55e' :
          isAlert         ? '#ff1a1a' : 'transparent'
        }
        borderWidth={isLocation || isAlert || isProofRequest || isProofResponse ? 1 : 0}
        borderRadius="$4"
        paddingHorizontal="$3"
        paddingVertical="$2"
        maxWidth="75%"
        gap="$1"
      >
        {!isMine && (
          <Text color="$colorSubtle" fontSize="$1" fontWeight="600">
            {message.fromAlias ?? message.fromId.slice(0, 8)}
          </Text>
        )}

        {isLocation ? (
          <LocationBubble text={message.text} />
        ) : isProofRequest ? (
          <ProofRequestBubbleContent text={message.text} fromSelf={isMine} />
        ) : isProofResponse ? (
          <ProofResponseBubbleContent text={message.text} fromSelf={isMine} />
        ) : (
          <Paragraph color="$color" fontSize="$3">{message.text}</Paragraph>
        )}

        <Text color="$colorSubtle" fontSize="$1" alignSelf="flex-end">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {message.hops > 0 ? ` · ${message.hops} hop${message.hops > 1 ? 's' : ''}` : ''}
        </Text>
      </YStack>
    </XStack>
  );
}
