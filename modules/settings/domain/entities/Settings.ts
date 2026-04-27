export interface SettingsEntity {
  key: string;
  value: string | null;
  encrypted: boolean;
}

export interface SettingsUpsertEntity {
  key: string;
  value: string | null;
  description?: string | null;
  encrypted?: boolean;
  tenantId?: string | null;
}
