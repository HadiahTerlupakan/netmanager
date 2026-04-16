import { useEffect, useState } from "react";
import { messaging } from "@/lib/firebase/config";
import { normalizeForegroundNotificationPayload } from "@/lib/notifications/normalizeForegroundNotificationPayload";
import { getToken, onMessage } from "firebase/messaging";
import { toast } from "react-hot-toast";

export const useFCM = () => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    const requestPermission = async () => {
      try {
        if (!messaging) return;
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          // Firebase FCM Vapid Key
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          });
          if (token) {
            setFcmToken(token);
            // Send token to our server registry
            await fetch("/api/user/fcm-token", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ fcmToken: token, action: "add" }),
            });
          }
        }
      } catch (error) {
        console.error("An error occurred while retrieving FCM token. ", error);
      }
    };

    requestPermission();

    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log("Firebase Message received in foreground.", payload);
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
    }
  }, []);

  return { fcmToken };
};
