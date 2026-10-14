import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/hooks/use-auth';
import { AuthProvider } from '@/providers/AuthProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  // Do not mount the navigator until the session has been restored. Mounting early would
  // treat a refresh on /dashboard as "signed out" and bounce the user to /login.
  if (status === 'loading') return <LoadingScreen />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Always reachable; they only redirect. */}
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/callback" />

      {/* Client-side route protection. This is UX; real enforcement is server-side (RLS). */}
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
