import type { IPlanningRepository } from "../domain/ports/IPlanningRepository";
import type { PlanningKanbanBoardDTO } from "../dto/PlanningKanbanDTO";
import type {
  PlanningEntity,
  PlanningStatus,
} from "../domain/entities/PlanningEntity";
import { PlanningDashboardMapper } from "../mappers/PlanningDashboardMapper";

export interface KanbanFilters {
  search?: string;
}

/**
 * Batas kartu yang dimuat papan kanban dalam satu kali muat.
 *
 * Papan ini memang dirancang menampilkan semua rencana sekaligus, tetapi
 * tanpa batas satu tenant besar akan menarik seluruh tabel ke memori. Batas
 * ini disengaja dan diberi nama supaya terlihat; bila sebuah tenant benar-benar
 * melewatinya, jawabannya adalah paginasi per kolom, bukan menaikkan angka.
 */
const KANBAN_MAX_CARDS = 1000;

/**
 * PlanningKanbanService
 * Service untuk kanban board view - grouping plannings by status
 * Read-only service tanpa mutations
 */
export class PlanningKanbanService {
  constructor(private readonly planningRepository: IPlanningRepository) {}

  /**
   * Get kanban board dengan plannings dikelompokkan berdasarkan status
   */
  async getKanbanBoard(
    tenantId: string | null,
    filters?: KanbanFilters,
  ): Promise<PlanningKanbanBoardDTO> {
    // Pencarian didorong ke SQL, bukan disaring setelah fetch. Sebelumnya
    // `search` diterapkan pada 1.000 baris terbaru yang sudah terambil,
    // sehingga rencana di luar jendela itu tidak akan pernah ditemukan
    // meskipun judulnya cocok persis.
    const { items } = await this.planningRepository.findAll({
      tenantId,
      search: filters?.search,
      page: 1,
      limit: KANBAN_MAX_CARDS,
    });

    // Group by status
    const groupedByStatus = this.groupByStatus(items);

    // Map to DTO
    return PlanningDashboardMapper.toKanbanBoard(groupedByStatus);
  }

  /**
   * Group plannings by status into 5 main columns
   * PENDING_APPROVAL includes both PENDING_APPROVAL and APPROVED_LEVEL1
   */
  private groupByStatus(
    items: PlanningEntity[],
  ): Map<PlanningStatus, PlanningEntity[]> {
    const groups = new Map<PlanningStatus, PlanningEntity[]>();

    // Initialize 5 main columns
    const columns: PlanningStatus[] = [
      "BACKLOG",
      "PENDING_APPROVAL",
      "APPROVED",
      "IN_PROGRESS",
      "COMPLETED",
    ];

    columns.forEach((status) => groups.set(status, []));

    // Group items
    items.forEach((item) => {
      // Map APPROVED_LEVEL1 to PENDING_APPROVAL column
      if (item.status === "APPROVED_LEVEL1") {
        const group = groups.get("PENDING_APPROVAL");
        if (group) group.push(item);
      } else if (groups.has(item.status)) {
        const group = groups.get(item.status);
        if (group) group.push(item);
      }
      // REJECTED and CANCELLED are excluded from kanban view
    });

    return groups;
  }
}
