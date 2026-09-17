export interface MitraDashboardProfile {
  siteId: string | null;
  mitraType: string;
  targetHarian: number | null;
  currentBalance: number;
}

export interface EmployeeDashboardProfile {
  siteId: string | null;
  departmentId: string | null;
  userSites: Array<{ siteId: string }>;
  canvasingTarget: number | null;
  targetSchema: string | null;
}

export interface MitraWorkOrderCountQuery {
  userId: string;
  tenantId: string;
}

export interface EmployeePendingWorkOrderQuery {
  tenantId: string;
  departmentId: string | null;
  userSiteIds: string[];
}

export interface EmployeeWorkOrderCountQuery {
  userId: string;
  tenantId: string;
}

export interface PeriodicCountQuery {
  userId: string;
  tenantId: string;
  since: Date;
}

export interface EmployeeCanvasingQuery {
  userId: string;
  tenantId: string;
  monthStart: Date;
}

export interface IMobileDashboardRepository {
  /** Mengambil profil dashboard mitra. */
  findMitraDashboardProfile(
    userId: string,
    tenantId: string,
  ): Promise<MitraDashboardProfile | null>;

  /** Menghitung WO aktif mitra. */
  countAssignedMitraWorkOrders(
    query: MitraWorkOrderCountQuery,
  ): Promise<number>;

  /** Menghitung WO selesai mitra sejak periode tertentu. */
  countClosedMitraWorkOrders(query: PeriodicCountQuery): Promise<number>;

  /** Menghitung WO mitra status ASSIGNED (menunggu dikerjakan). */
  countPendingMitraWorkOrders(query: MitraWorkOrderCountQuery): Promise<number>;

  /** Mengambil profil dashboard employee. */
  findEmployeeDashboardProfile(
    userId: string,
    tenantId: string,
  ): Promise<EmployeeDashboardProfile | null>;

  /** Menghitung WO aktif employee. */
  countAssignedEmployeeWorkOrders(
    query: EmployeeWorkOrderCountQuery,
  ): Promise<number>;

  /** Menghitung WO pending yang dapat diklaim employee. */
  countPendingEmployeeWorkOrders(
    query: EmployeePendingWorkOrderQuery,
  ): Promise<number>;

  /** Menghitung WO selesai employee sejak periode tertentu. */
  countClosedEmployeeWorkOrders(query: PeriodicCountQuery): Promise<number>;

  /** Menghitung barang keluar employee hari ini. */
  countBarangKeluarToday(query: PeriodicCountQuery): Promise<number>;

  /** Menghitung barang masuk employee hari ini. */
  countBarangMasukToday(query: PeriodicCountQuery): Promise<number>;

  /** Menghitung canvasing monthly reset employee. */
  countMonthlyCanvasing(query: EmployeeCanvasingQuery): Promise<number>;

  /** Menghitung point claim akumulatif employee. */
  countAccumulatedCanvasing(query: EmployeeCanvasingQuery): Promise<number>;

  /** Menghitung closing canvasing bulanan mitra. */
  countMitraClosingMonth(query: EmployeeCanvasingQuery): Promise<number>;
}
