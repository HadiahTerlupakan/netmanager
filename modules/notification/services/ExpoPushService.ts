import { logger } from "@/lib/logger";
import { UserLookupService } from "@/modules/users";
import {
  getMitraLookupService,
  type MitraLookupService,
} from "@/modules/mitra";
import { enqueuePushRetry } from "./PushRetryQueue";
import { PelangganPushTokenService } from "@/modules/pelanggan";
import {
  chunkExpoPushMessages,
  collectChunkFailedTokens,
  buildChunkFailureTokens,
  createExpoPushMessage,
  postExpoPushChunk,
  delayBetweenExpoChunks,
  processFailedExpoTokens,
  type ExpoPushMessage,
  type FailedToken,
  type PushFailureDependencies,
  type ExpoPushTicket,
} from "./ExpoPushService.helpers";

let userRepo: UserLookupService | null = null;
let mitraLookupService: MitraLookupService | null = null;
let pelangganPushTokenService: PelangganPushTokenService | null = null;

function getUserRepo(): UserLookupService {
  if (!userRepo) {
    userRepo = new UserLookupService();
  }
  return userRepo;
}

function getMitraRepo(): MitraLookupService {
  if (!mitraLookupService) {
    mitraLookupService = getMitraLookupService();
  }
  return mitraLookupService;
}

function getPelangganPushTokenService(): PelangganPushTokenService {
  if (!pelangganPushTokenService) {
    pelangganPushTokenService = new PelangganPushTokenService();
  }
  return pelangganPushTokenService;
}

function getPushFailureDependencies(): PushFailureDependencies {
  return {
    clearUserTokens: async (tokens) => {
      await getUserRepo().clearPushTokens(tokens);
    },
    clearMitraTokens: async (tokens) => {
      await getMitraRepo().clearPushTokens(tokens);
    },
    clearPelangganTokens: async (tokens) => {
      await getPelangganPushTokenService().clearPushTokens(tokens);
    },
    findUsers: (tokens) => getUserRepo().findManyWithPushToken(tokens),
    findMitras: (tokens) => getMitraRepo().findManyWithPushToken(tokens),
    findPelanggans: (tokens) =>
      getPelangganPushTokenService().findManyWithPushToken(tokens),
    enqueueRetry: enqueuePushRetry,
  };
}

async function handleFailedTokens(
  failedTokens: FailedToken[],
  originalMessages: ExpoPushMessage[],
) {
  await processFailedExpoTokens(
    failedTokens,
    originalMessages,
    getPushFailureDependencies(),
  );
}

async function sendExpoPushChunk(
  chunk: ExpoPushMessage[],
  chunkIndex: number,
  totalChunks: number,
): Promise<FailedToken[]> {
  await delayBetweenExpoChunks(chunkIndex);

  try {
    const response = await postExpoPushChunk(chunk);
    if (!response.ok) {
      logger.error(
        `[Push] Expo API HTTP error ${response.status} for chunk ${chunkIndex + 1}/${totalChunks}`,
      );
      return buildChunkFailureTokens(chunk, "HTTP_ERROR");
    }

    const result = await response.json();
    return result.data
      ? collectChunkFailedTokens(chunk, result.data as ExpoPushTicket[])
      : [];
  } catch (error) {
    logger.error(
      `[Push] Failed to send chunk ${chunkIndex + 1}/${totalChunks}:`,
      error,
    );
    return buildChunkFailureTokens(chunk, "NETWORK_ERROR");
  }
}

async function sendExpoPush(
  messages: ExpoPushMessage[],
): Promise<{ success: boolean; failedTokens: FailedToken[] }> {
  if (messages.length === 0) {
    return { success: true, failedTokens: [] };
  }

  const failedTokens: FailedToken[] = [];
  let allSucceeded = true;

  try {
    const chunks = chunkExpoPushMessages(messages);
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const chunkFailures = await sendExpoPushChunk(
        chunk,
        chunkIndex,
        chunks.length,
      );
      if (chunkFailures.length > 0) {
        allSucceeded = false;
        failedTokens.push(...chunkFailures);
      }
    }

    return { success: allSucceeded, failedTokens };
  } catch (error) {
    logger.error("[Push] Expo API error:", error);
    return {
      success: false,
      failedTokens: buildChunkFailureTokens(messages, "CRITICAL_ERROR"),
    };
  }
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  try {
    let pushToken: string | null = null;
    const user = await getUserRepo().findByIdWithPushToken(userId);
    pushToken = user?.pushToken || null;
    if (!pushToken) {
      const mitra = await getMitraRepo().findPushTokenById(userId);
      pushToken = mitra?.pushToken || null;
    }
    if (!pushToken) return false;
    const messages: ExpoPushMessage[] = [
      createExpoPushMessage({ token: pushToken, title, body, data }),
    ];
    const { success, failedTokens } = await sendExpoPush(messages);
    if (!success && failedTokens.length > 0)
      await handleFailedTokens(failedTokens, messages);
    return success;
  } catch (error) {
    logger.error("[Push] Error sending notification:", error);
    return false;
  }
}

export async function sendCustomerPushNotification(
  pelangganId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  try {
    const pelanggan =
      await getPelangganPushTokenService().findByIdWithPushToken(pelangganId);
    if (!pelanggan?.pushToken) return false;
    const messages: ExpoPushMessage[] = [
      createExpoPushMessage({ token: pelanggan.pushToken, title, body, data }),
    ];
    const { success, failedTokens } = await sendExpoPush(messages);
    if (!success && failedTokens.length > 0)
      await handleFailedTokens(failedTokens, messages);
    return success;
  } catch (error) {
    logger.error("[Push] Error sending customer notification:", error);
    return false;
  }
}

export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<number> {
  try {
    const users = await getUserRepo().findManyWithPushTokenAndFilter(userIds);
    const foundUserIds = users.map((user) => user.id);
    const missingUserIds = userIds.filter((id) => !foundUserIds.includes(id));
    const mitras =
      missingUserIds.length > 0
        ? await getMitraRepo().findManyWithPushTokenByIds(missingUserIds)
        : [];
    const allTokens: string[] = [];
    for (const user of users)
      if (user.pushToken) allTokens.push(user.pushToken);
    for (const mitra of mitras)
      if (mitra.pushToken) allTokens.push(mitra.pushToken);
    if (allTokens.length === 0) return 0;
    const messages: ExpoPushMessage[] = allTokens.map((token) =>
      createExpoPushMessage({ token, title, body, data }),
    );
    const { success, failedTokens } = await sendExpoPush(messages);
    if (!success && failedTokens.length > 0)
      await handleFailedTokens(failedTokens, messages);
    return allTokens.length - failedTokens.length;
  } catch (error) {
    logger.error("[Push] Error sending notifications:", error);
    return 0;
  }
}

export async function sendPushForNotification(
  userId: string,
  title: string,
  message: string,
  link?: string,
  sourceType?: string,
  sourceId?: string,
): Promise<void> {
  await sendPushNotification(userId, title, message, {
    link,
    sourceType,
    sourceId,
  });
}

export async function sendPushToDepartment(
  departmentId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<number> {
  try {
    const users =
      await getUserRepo().findManyByDepartmentWithPushToken(departmentId);
    if (users.length === 0) return 0;
    const messages: ExpoPushMessage[] = users.map(
      (user: { id: string; pushToken: string | null }) =>
        createExpoPushMessage({ token: user.pushToken!, title, body, data }),
    );
    const { success, failedTokens } = await sendExpoPush(messages);
    if (!success && failedTokens.length > 0)
      await handleFailedTokens(failedTokens, messages);
    return users.length - failedTokens.length;
  } catch (error) {
    logger.error("[Push] Error sending to department:", error);
    return 0;
  }
}
