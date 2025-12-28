import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SocketProvider } from '../context/SocketContext';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import tw from 'twrnc';
import { DatabaseService } from '../services/DatabaseService';
import { SyncService } from '../services/SyncService';

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const segments = useSegments();
  const router = useRouter();

  // Initialize Offline Services
  useEffect(() => {
    const initServices = async () => {
      await DatabaseService.initDatabase();
      SyncService.startMonitoring();
    };
    initServices();
  }, []);

  // Handle Push Notifications
  useEffect(() => {
    // Import dynamically to avoid circular dependencies if any
    const setupNotifications = async () => {
      const { addNotificationListeners } = await import('../services/PushNotificationService');

      const cleanup = addNotificationListeners(
        (notification) => {
          // Handle foreground notification received
          console.log('Foreground notification:', notification);
        },
        (response) => {
          // Handle notification tap
          const data = response.notification.request.content.data;
          console.log('Notification tapped, data:', data);

          if (data?.url) {
            try {
              // Navigate to the URL provided in payload
              // Example url: /work-orders/cmjlgercn0000n9hdnhvhhs9d
              router.push(data.url as any);
            } catch (e) {
              console.error('Navigation failed:', e);
            }
          }
        }
      );

      return cleanup;
    };

    let cleanupFn: (() => void) | undefined;
    setupNotifications().then(cleanup => { cleanupFn = cleanup; });

    return () => {
      if (cleanupFn) cleanupFn();
    };
  }, []);

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

