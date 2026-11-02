import type { PushTokenOwnerTokensEntity } from "../entities/PushTokenOwnerEntity";

export interface IMobileFcmSession {
  userId?: string;
  id?: string;
  role?: string;
  tenantId?: string | null;
}

export interface IPushTokenRepository {
  clearPushTokens(tokens: string[]): Promise<void>;
  clearFcmTokensFromArrays(tokens: string[]): Promise<number>;
  findOwnerTokens(
    session: IMobileFcmSession,
    userId: string,
  ): Promise<PushTokenOwnerTokensEntity | null>;
  appendOwnerToken(
    session: IMobileFcmSession,
    userId: string,
    fcmToken: string,
  ): Promise<void>;
  replaceOwnerTokens(
    session: IMobileFcmSession,
    userId: string,
    fcmTokens: string[],
  ): Promise<void>;
}
