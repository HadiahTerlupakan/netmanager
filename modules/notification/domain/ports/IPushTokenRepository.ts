import type {
  PushTokenOwnerEntity,
  PushTokenOwnerTokensEntity,
} from "../entities/PushTokenOwnerEntity";

export interface IMobileFcmSession {
  userId?: string;
  id?: string;
  role?: string;
  tenantId?: string | null;
}

export interface IPushTokenRepository {
  findUserPushToken(userId: string): Promise<string | null>;
  findMitraPushToken(mitraId: string): Promise<string | null>;
  findPelangganPushToken(pelangganId: string): Promise<string | null>;
  findUsersWithPushToken(userIds: string[]): Promise<PushTokenOwnerEntity[]>;
  findMitrasWithPushToken(mitraIds: string[]): Promise<PushTokenOwnerEntity[]>;
  findUsersByDepartmentWithPushToken(
    departmentId: string,
  ): Promise<PushTokenOwnerEntity[]>;
  findActiveUsersWithPushTokenBySite(
    departmentId?: string,
    siteId?: string,
    excludeUserId?: string,
  ): Promise<Array<{ id: string }>>;
  clearPushTokens(tokens: string[]): Promise<void>;
  findUsersByPushTokens(tokens: string[]): Promise<PushTokenOwnerEntity[]>;
  findMitrasByPushTokens(tokens: string[]): Promise<PushTokenOwnerEntity[]>;
  findPelanggansByPushTokens(tokens: string[]): Promise<PushTokenOwnerEntity[]>;
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
  clearLegacyPushTokenOwners(input: {
    userId: string;
    tenantId: string | null;
    pushToken: string;
  }): Promise<void>;
  updateLegacyOwnerPushToken(
    session: IMobileFcmSession,
    pushToken: string | null,
  ): Promise<void>;
}
