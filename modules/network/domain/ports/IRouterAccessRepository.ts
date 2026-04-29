export interface RouterUserSiteEntity {
  siteId: string | null;
}

export interface GeneratedApiUserUpdateInput {
  apiUsernameGenerated: string;
  apiPasswordGenerated: string;
}

export interface IRouterAccessRepository {
  /** Ambil site user untuk validasi akses router. */
  findUserSite(userId: string): Promise<RouterUserSiteEntity | null>;

  /** Simpan kredensial API generated pada router. */
  updateGeneratedApiUser(
    id: string,
    data: GeneratedApiUserUpdateInput,
  ): Promise<void>;
}
