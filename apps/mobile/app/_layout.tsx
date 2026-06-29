import { useEffect } from 'react';
import { TamaguiProvider } from 'tamagui';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { tamaguiConfig } from '@quakelink/ui';
import { IdentityProvider, useIdentity } from '@quakelink/identity';
import { DirectBleProvider } from '../hooks/DirectBleProvider';
import { configureAlerts } from '../lib/alerts';

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
  useEffect(() => {
    configureAlerts();
  }, []);

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <IdentityProvider>
        <DirectBleProvider>
          <StatusBar style="light" />
          <NavigationGuard />
          <Stack screenOptions={{ headerShown: false }} />
        </DirectBleProvider>
      </IdentityProvider>
    </TamaguiProvider>
  );
}
