export interface RouterUserSiteEntity {
  siteId: string | null;
}

export interface GeneratedApiUserUpdateInput {
  apiUsernameGenerated: string;
  apiPasswordGenerated: string;
}

export interface RouterSettingEntity {
  value: string;
}

export interface IRouterAccessRepository {
  /** Ambil site user untuk validasi akses router. */
  findUserSite(userId: string): Promise<RouterUserSiteEntity | null>;

  /** Ambil setting untuk kebutuhan provisioning router. */
  findSettingByKey(key: string): Promise<RouterSettingEntity | null>;

  /** Simpan kredensial API generated pada router. */
  updateGeneratedApiUser(
    id: string,
    data: GeneratedApiUserUpdateInput,
  ): Promise<void>;
}
