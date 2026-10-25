export interface RouterUserSiteEntity {
  siteId: string | null;
}

export interface GeneratedApiUserUpdateInput {
  apiUsernameGenerated: string;
  apiPasswordGenerated: string;
}

/** Status kirim halaman isolir router; `syncedAt` kosong berarti tidak diubah. */
export interface IsolirPageSyncUpdate {
  hash: string | null;
  syncedAt?: Date;
  error: string | null;
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

  /** Simpan status kirim halaman isolir router. */
  updateIsolirPageSync(id: string, data: IsolirPageSyncUpdate): Promise<void>;
}
