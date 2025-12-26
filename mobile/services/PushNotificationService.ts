import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import axios from 'axios';
import { Config } from '@/constants/Config';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export async function registerForPushNotificationsAsync(token?: string): Promise<string | null> {
    let pushToken: string | null = null;

    // Check if running on physical device
    // if (!Device.isDevice) {
    //     console.log('Push notifications require a physical device');
    //     // return null; // Allow emulator to try registration
    // }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
    }

    // Get Expo Push Token
    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

        if (!projectId) {
            console.log('Project ID not found');
            return null;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        pushToken = tokenData.data;
        console.log('Push token:', pushToken);

        // Register token with backend
        if (token && pushToken) {
            try {
                await axios.post(
                    `${Config.API_URL}/api/mobile/push-token`,
                    { pushToken },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log('Push token registered with backend');
            } catch (error) {
                console.error('Failed to register push token:', error);
            }
        }
    } catch (error) {
        console.error('Error getting push token:', error);
    }

    // Configure Android channel
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    return pushToken;
}

// Send local notification (for testing)
export async function sendLocalNotification(title: string, body: string, data?: object) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data: data || {},
        },
        trigger: null, // immediately
    });
}

// Add notification listeners
export function addNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
) {
    const receivedListener = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification);
        onNotificationReceived?.(notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification response:', response);
        onNotificationResponse?.(response);
    });

    return () => {
        receivedListener.remove();
        responseListener.remove();
    };
}
