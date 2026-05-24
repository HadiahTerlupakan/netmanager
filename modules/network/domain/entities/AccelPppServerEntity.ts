export interface AccelPppServerEntity {
  id: string;
  name: string;
  ipAddress: string;
  description: string | null;

  nasIdentifier: string | null;
  radiusSecret: string;
  authPort: number;
  acctPort: number;
  /**
   * Port CoA / Disconnect-Request (RFC 5176). Disimpan saat ini sebagai
   * placeholder—belum dipakai oleh service. Diperlukan ketika fitur kick
   * sesi via CoA Disconnect-Request diaktifkan (lihat spec section
   * "Out of Scope"). Default 3799 mengikuti FreeRADIUS standard.
   */
  coaPort: number;

  cliHost: string;
  cliPort: number;
  cliPassword: string | null;

  pingStatus: string;
  userOnline: number;
  lastStatusCheck: Date | null;

  siteId: string | null;
  tenantId: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface AccelPppServerCreateData {
  name: string;
  ipAddress: string;
  description?: string | null;

  nasIdentifier?: string | null;
  radiusSecret: string;
  authPort?: number;
  acctPort?: number;
  coaPort?: number;

  cliHost: string;
  cliPort?: number;
  cliPassword?: string | null;

  siteId?: string | null;
  tenantId?: string | null;
}

export interface AccelPppServerUpdateData {
  name?: string;
  ipAddress?: string;
  description?: string | null;

  nasIdentifier?: string | null;
  radiusSecret?: string;
  authPort?: number;
  acctPort?: number;
  coaPort?: number;

  cliHost?: string;
  cliPort?: number;
  cliPassword?: string | null;

  pingStatus?: string;
  userOnline?: number;
  lastStatusCheck?: Date | null;

  siteId?: string | null;
}

export interface AccelPppServerStatusUpdate {
  pingStatus: string;
  userOnline: number;
  lastStatusCheck: Date;
}

export interface AccelPppServerFilters {
  search?: string;
  siteId?: string;
  pingStatus?: string;
}
