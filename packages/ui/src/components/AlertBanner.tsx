import { XStack, Text } from 'tamagui';

type Props = {
  message: string;
  severity: 'low' | 'medium' | 'high';
};

const severityColors = {
  low: '#f5a623',
  medium: '#f55a23',
  high: '#ff1a1a',
} as const;

export function AlertBanner({ message, severity }: Props) {
  const color = severityColors[severity];

  return (
    <XStack
      backgroundColor={`${color}22`}
      borderColor={color}
      borderWidth={1}
      borderRadius="$3"
      padding="$3"
      alignItems="center"
      gap="$2"
    >
      <Text color={color} fontWeight="700" fontSize="$3">
        ⚠ {message}
      </Text>
    </XStack>
  );
}
