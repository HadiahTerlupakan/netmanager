import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SocketProvider } from '../context/SocketContext';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import tw from 'twrnc';

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    console.log('[RootLayout] Effect triggered. User:', !!user, 'Segments:', segments, 'Loading:', isLoading);

    if (isLoading) {
      console.log('[RootLayout] Still loading, skipping redirect check');
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    console.log('[RootLayout] Status:', { user: !!user, inAuthGroup, inAppGroup, segments });

    if (!user && !inAuthGroup) {
      console.log('[RootLayout] Redirecting to Login');
      router.replace('/(auth)/login');
    } else if (user && !inAppGroup) {
      // Redirect to dashboard if logged in but not in (app) group (e.g. at root or login page)
      console.log('[RootLayout] Redirecting to Dashboard');
      router.replace('/(app)/dashboard');
    }
  }, [user, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-gray-900`}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <SocketProvider>
        <Slot />
      </SocketProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

