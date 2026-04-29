export type MixRadiusDismantleRequestContext = {
  requester: { id: string; siteId: string | null } | null;
  localPelanggan: { id: string; siteId: string | null } | null;
  department: { id: string } | null;
};

/** Repository port for MixRadius dismantle persistence. */
export interface IMixRadiusDismantleRepository {
  findRequestContext(input: {
    userId: string;
    memberId: string;
    username: string;
    departmentKeyword: string;
  }): Promise<MixRadiusDismantleRequestContext>;
  createDefaultTasks(workOrderId: string): Promise<void>;
}
