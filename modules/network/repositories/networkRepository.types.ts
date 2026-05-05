export interface ActiveTenant {
  id: string;
}

export interface SettingRecord {
  id: string;
  key: string;
  value: string;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingKeyValue {
  key: string;
  value: string;
}

export interface RouterTenantId {
  tenantId: string | null;
}

export interface RouterBasic {
  id: string;
  ipAddress: string;
  tenantId: string | null;
}

export interface RouterConnectionRecord {
  id: string;
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
  apiUsernameGenerated: string | null;
  apiPasswordGenerated: string | null;
}

export interface RouterReconfigureRecord {
  id: string;
  name: string;
  ipAddress: string;
  apiPort: number;
  pingStatus: string;
  apiUsername: string;
  apiPassword: string;
  apiUsernameGenerated: string | null;
  apiPasswordGenerated: string | null;
  siteId: string | null;
}

export interface RouterGeneratedApiUserRecord {
  apiUsernameGenerated: string;
  apiPasswordGenerated: string;
}

export interface UserSiteRecord {
  siteId: string | null;
}

export interface PelangganWithRouter {
  id: string;
  username: string;
  password: string;
  nama: string;
  status: string;
  tenantId: string | null;
  hargaPaket: {
    id: string;
    profilePPP: {
      id: string;
      name: string;
      mikroTikRouter: {
        id: string;
        ipAddress: string;
        apiPort: number;
        apiUsername: string;
        apiPassword: string;
        apiUsernameGenerated: string | null;
        apiPasswordGenerated: string | null;
      } | null;
    } | null;
  } | null;
}

export interface PelangganBasic {
  id: string;
  username: string;
  status: string;
  tenantId: string | null;
}

export interface PelangganWithRouterBasic {
  id: string;
  username: string;
  tenantId: string | null;
  hargaPaket: {
    profilePPP: {
      mikroTikRouter: {
        id: string;
      } | null;
    } | null;
  } | null;
}
