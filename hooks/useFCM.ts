import { useCallback, useEffect, useState } from "react";
import {
  isFirebaseMessagingConfigured,
  messaging,
} from "@/lib/firebase/config";
import { normalizeForegroundNotificationPayload } from "@/lib/notifications/normalizeForegroundNotificationPayload";
import { getToken, onMessage } from "firebase/messaging";
import { toast } from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";

type NotificationSupportState = NotificationPermission | "unsupported";

function getNotificationSupportState(): NotificationSupportState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

export const useFCM = () => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationSupportState>(
    getNotificationSupportState,
  );
  const [isLoading, setIsLoading] = useState(false);

  const isSupported =
    permission !== "unsupported" &&
    Boolean(messaging) &&
    isFirebaseMessagingConfigured;

  const registerToken = useCallback(async () => {
    if (!messaging || !isFirebaseMessagingConfigured) {
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    if (!token) {
      return null;
    }

    const response = await fetch("/api/user/fcm-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fcmToken: token, action: "add" }),
    });

    if (!response.ok) {
      setFcmToken(null);
      return null;
    }

    setFcmToken(token);
    return token;
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!isSupported) {
      return false;
    }

    setIsLoading(true);

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        setFcmToken(null);
        return false;
      }

      const token = await registerToken();
      return Boolean(token);
    } catch (error) {
      clientLogger.error(
        "An error occurred while retrieving FCM token.",
        error,
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, registerToken]);

  useEffect(() => {
    const currentPermission = getNotificationSupportState();
    setPermission(currentPermission);

    if (currentPermission === "granted") {
      void registerToken();
    }
  }, [registerToken]);

  useEffect(() => {
    if (!messaging) {
      return;
    }

    const unsubscribe = onMessage(messaging, (payload) => {
      const message = normalizeForegroundNotificationPayload({
        notification: payload.notification,
        data: payload.data,
      });

      if (message) {
        toast.success(`${message.title}: ${message.body}`, {
          duration: 5000,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    fcmToken,
    permission,
    isSupported,
    isLoading,
    isRegistered: Boolean(fcmToken),
    enableNotifications,
  };
};
