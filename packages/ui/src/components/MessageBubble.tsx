import { YStack, XStack, Text, Paragraph } from 'tamagui';
import type { MeshMessage } from '@quakelink/mesh';

type Props = {
  message: MeshMessage;
};

export function MessageBubble({ message }: Props) {
  const isMine = message.fromSelf;
  const isAlert = message.type === 'alert';

  return (
    <XStack
      justifyContent={isMine ? 'flex-end' : 'flex-start'}
      marginBottom="$2"
      paddingHorizontal="$1"
    >
      <YStack
        backgroundColor={isAlert ? '#ff1a1a22' : isMine ? '$blue9' : '$backgroundPress'}
        borderColor={isAlert ? '#ff1a1a' : 'transparent'}
        borderWidth={isAlert ? 1 : 0}
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
        <Paragraph color="$color" fontSize="$3">
          {message.text}
        </Paragraph>
        <Text color="$colorSubtle" fontSize="$1" alignSelf="flex-end">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {message.hops > 0 ? ` · ${message.hops} hop${message.hops > 1 ? 's' : ''}` : ''}
        </Text>
      </YStack>
    </XStack>
  );
}
