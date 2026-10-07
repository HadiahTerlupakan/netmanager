import type {
  IWorkOrderServiceLevelRepository,
  ServiceLevelWorkOrderQuery,
  ServiceLevelWorkOrderRecord,
} from "../domain/ports/IWorkOrderServiceLevelRepository";
import { createWorkOrderServiceLevelRepository } from "../repositories/WorkOrderServiceLevelRepository";

export type { ServiceLevelWorkOrderQuery, ServiceLevelWorkOrderRecord };

/**
 * Akses baca work order untuk laporan mutu layanan (mis. Self-Assessment
 * Komdigi). Modul lain memakai kelas ini, bukan tabel work order langsung.
 */
export class WorkOrderServiceLevelQueryService {
  constructor(
    private readonly repository: IWorkOrderServiceLevelRepository = createWorkOrderServiceLevelRepository(),
  ) {}

  /** Work order instalasi/troubleshoot dalam rentang waktu, tanpa yang dibatalkan. */
  listForServiceLevel(
    query: ServiceLevelWorkOrderQuery,
  ): Promise<ServiceLevelWorkOrderRecord[]> {
    return this.repository.findForServiceLevel(query);
  }
}
