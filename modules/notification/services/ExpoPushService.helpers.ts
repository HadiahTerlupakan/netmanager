import { logger } from "@/lib/logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK_SIZE = 100;
const EXPO_CHUNK_DELAY_MS = 200;
const EXPO_SOUND = "default";
const DEVICE_NOT_REGISTERED_ERROR = "DeviceNotRegistered";
const UNKNOWN_USER_ID = "unknown";

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: unknown;
}

export interface FailedToken {
  token: string;
  error: string;
  details?: unknown;
}

export interface PushTokenRecord {
  id: string;
  pushToken: string | null;
}

export interface PushFailureDependencies {
  clearUserTokens(tokens: string[]): Promise<void>;
  clearMitraTokens(tokens: string[]): Promise<void>;
  clearPelangganTokens(tokens: string[]): Promise<void>;
  findUsers(tokens: string[]): Promise<PushTokenRecord[]>;
  findMitras(tokens: string[]): Promise<PushTokenRecord[]>;
  findPelanggans(tokens: string[]): Promise<PushTokenRecord[]>;
  enqueueRetry(item: {
    type: "expo";
    userId: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    pushToken: string;
  }): Promise<void>;
}

/** Build one Expo push message payload. */
export function createExpoPushMessage(input: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): ExpoPushMessage {
  return {
    to: input.token,
    title: input.title,
    body: input.body,
    data: input.data || {},
    sound: EXPO_SOUND,
  };
}

/** Split Expo push messages into API-sized chunks. */
export function chunkExpoPushMessages(
  messages: ExpoPushMessage[],
): ExpoPushMessage[][] {
  const chunks: ExpoPushMessage[][] = [];
  for (let index = 0; index < messages.length; index += EXPO_CHUNK_SIZE) {
    chunks.push(messages.slice(index, index + EXPO_CHUNK_SIZE));
  }
  return chunks;
}

/** Wait between Expo push chunks to preserve existing throttling behavior. */
export async function delayBetweenExpoChunks(
  chunkIndex: number,
): Promise<void> {
  if (chunkIndex === 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, EXPO_CHUNK_DELAY_MS));
}

/** Send one chunk to the Expo push API. */
export async function postExpoPushChunk(chunk: ExpoPushMessage[]) {
  return fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(chunk),
  });
}

/** Extract failed Expo tickets from one API chunk response. */
export function collectChunkFailedTokens(
  chunk: ExpoPushMessage[],
  tickets: ExpoPushTicket[],
): FailedToken[] {
  const failures: FailedToken[] = [];
  for (let ticketIndex = 0; ticketIndex < tickets.length; ticketIndex++) {
    const ticket = tickets[ticketIndex];
    if (ticket.status !== "error") {
      continue;
    }

    failures.push({
      token: chunk[ticketIndex].to,
      error: resolveExpoTicketError(ticket),
      details: ticket.details,
    });
  }
  return failures;
}

/** Build identical failure records for all tokens in one chunk. */
export function buildChunkFailureTokens(
  chunk: ExpoPushMessage[],
  error: string,
): FailedToken[] {
  return chunk.map((message) => ({ token: message.to, error }));
}

/** Resolve a stable Expo ticket error code. */
export function resolveExpoTicketError(ticket: ExpoPushTicket): string {
  return (
    ((ticket.details as Record<string, unknown>)?.error as string) ||
    ticket.message ||
    "Unknown"
  );
}

/** Return failed tokens that must be deleted permanently. */
export function filterTokensToRemove(failedTokens: FailedToken[]): string[] {
  return failedTokens
    .filter((failedToken) => failedToken.error === DEVICE_NOT_REGISTERED_ERROR)
    .map((failedToken) => failedToken.token);
}

/** Return failed tokens that should enter the retry queue. */
export function filterTokensToRetry(failedTokens: FailedToken[]): string[] {
  return failedTokens
    .filter((failedToken) => failedToken.error !== DEVICE_NOT_REGISTERED_ERROR)
    .map((failedToken) => failedToken.token);
}

/** Build push token owner lookup map across module owners. */
export function buildTokenOwnerMap(
  groups: PushTokenRecord[][],
): Record<string, string> {
  const tokenOwnerMap: Record<string, string> = {};
  for (const group of groups) {
    for (const record of group) {
      if (record.pushToken) {
        tokenOwnerMap[record.pushToken] = record.id;
      }
    }
  }
  return tokenOwnerMap;
}

/** Queue retries for retryable failed tokens. */
export async function enqueueRetryableTokens(input: {
  tokens: string[];
  originalMessages: ExpoPushMessage[];
  tokenOwnerMap: Record<string, string>;
  enqueueRetry: PushFailureDependencies["enqueueRetry"];
}): Promise<void> {
  for (const token of input.tokens) {
    const message = input.originalMessages.find((item) => item.to === token);
    if (!message) {
      continue;
    }

    await input.enqueueRetry({
      type: "expo",
      userId: input.tokenOwnerMap[token] || UNKNOWN_USER_ID,
      title: message.title,
      body: message.body,
      data: message.data as Record<string, unknown>,
      pushToken: token,
    });
  }
}

/** Handle failed Expo tokens using the existing cleanup and retry semantics. */
export async function processFailedExpoTokens(
  failedTokens: FailedToken[],
  originalMessages: ExpoPushMessage[],
  dependencies: PushFailureDependencies,
): Promise<void> {
  const tokensToRemove = filterTokensToRemove(failedTokens);
  if (tokensToRemove.length > 0) {
    logger.info(
      `[Push] Removing ${tokensToRemove.length} unregistered Expo push tokens`,
    );
    await Promise.all([
      dependencies.clearUserTokens(tokensToRemove),
      dependencies.clearMitraTokens(tokensToRemove),
      dependencies.clearPelangganTokens(tokensToRemove),
    ]);
  }

  const tokensToRetry = filterTokensToRetry(failedTokens);
  if (tokensToRetry.length === 0) {
    return;
  }

  const tokenOwnerMap = buildTokenOwnerMap(
    await Promise.all([
      dependencies.findUsers(tokensToRetry),
      dependencies.findMitras(tokensToRetry),
      dependencies.findPelanggans(tokensToRetry),
    ]),
  );

  await enqueueRetryableTokens({
    tokens: tokensToRetry,
    originalMessages,
    tokenOwnerMap,
    enqueueRetry: dependencies.enqueueRetry,
  });
}
