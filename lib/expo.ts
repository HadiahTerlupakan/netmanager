import { getPushCollapseKey } from "@/lib/firebase/push-collapse";
import { logger } from "@/lib/logger";
import { PUSH_SOUND_IOS } from "@/lib/push-sound";
import { Expo, type ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export const sendExpoPushNotifications = async (
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
) => {
  if (!tokens.length) return;

  // Sama dengan push Expo lainnya: tanpa channelId, karena pemasangan era
  // Expo hanya punya channel `default` dan Expo membuang push ke channel lain.
  const collapseKey = getPushCollapseKey(data);
  const messages: ExpoPushMessage[] = [];
  for (const token of tokens) {
    if (!Expo.isExpoPushToken(token)) {
      logger.error(`Push token ${token} is not a valid Expo push token`);
      continue;
    }

    messages.push({
      to: token,
      sound: PUSH_SOUND_IOS,
      title,
      body,
      data,
      collapseId: collapseKey,
      tag: collapseKey,
    });
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      logger.error(error);
    }
  }

  // Optional: processing receipts logic could go here
  return tickets;
};
