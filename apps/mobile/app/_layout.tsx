import { useEffect } from 'react';
import { TamaguiProvider } from 'tamagui';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { tamaguiConfig } from '@quakelink/ui';
import { IdentityProvider, useIdentity } from '@quakelink/identity';

function NavigationGuard() {
  const { identity, isLoading } = useIdentity();
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inOnboarding = segments[0] === 'onboarding';

    if (!identity && !inOnboarding) {
      router.replace('/onboarding/welcome');
    } else if (identity && inOnboarding) {
      router.replace('/(tabs)/');
    }
  }, [identity, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <IdentityProvider>
        <StatusBar style="light" />
        <NavigationGuard />
        <Stack screenOptions={{ headerShown: false }} />
      </IdentityProvider>
    </TamaguiProvider>
  );
}
