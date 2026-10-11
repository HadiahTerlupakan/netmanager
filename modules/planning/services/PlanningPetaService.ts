import type { MappingEdge, MappingNode } from "@prisma/client";

import type { PlanningEntity } from "../domain/entities/PlanningEntity";
import type { IPlanningRepository } from "../domain/ports/IPlanningRepository";
import type { IPlanningUnitOfWork } from "../domain/ports/IPlanningUnitOfWork";
import type {
  JalurRencanaDTO,
  PetaPlanningDTO,
  TitikRencanaDTO,
} from "../dto/PlanningPetaDTO";
import {
  PlanningInvalidStateError,
  PlanningNotFoundError,
  PlanningValidationError,
} from "../errors/planning-errors";
import { PlanningPetaMapper } from "../mappers/PlanningPetaMapper";
import type { PlanningPetaRepository } from "../repositories/PlanningPetaRepository";
import type {
  BuatJalurRencanaInput,
  BuatTitikRencanaInput,
} from "../validators/planningPetaSchemas";
import type { PlanningAuditService } from "./PlanningAuditService";
import { logger } from "@/lib/logger";

/** Repository peta dipakai lewat transaksi Prisma yang sama dengan audit. */
type PrismaTx = Parameters<PlanningPetaRepository["buatTitik"]>[1];

/**
 * PlanningPetaService
 *
 * Aturan titik & jalur rencana pada peta sebuah Planning OSP: kepemilikan
 * tenant, status rencana yang masih boleh diubah, kepemilikan titik/jalur oleh
 * rencana yang dimaksud, dan perlindungan terhadap node yang sudah terbit
 * menjadi jaringan nyata. Setiap perubahan ditulis ke audit trail dalam
 * transaksi yang sama.
 */
export class PlanningPetaService {
  constructor(
    private readonly planningRepo: IPlanningRepository,
    private readonly petaRepo: PlanningPetaRepository,
    private readonly auditService: PlanningAuditService,
    private readonly unitOfWork: IPlanningUnitOfWork,
  ) {}

  /** Mengambil rencana milik tenant pemanggil (lihat `PlanningItemService`). */
  private async findOwnedPlanning(
    planningId: string,
    tenantId: string,
  ): Promise<PlanningEntity> {
    const planning = await this.planningRepo.findById(planningId);

    if (!planning || planning.tenantId !== tenantId) {
      throw new PlanningNotFoundError();
    }

    return planning;
  }

  /** Peta ikut terkunci bersama ruang lingkup: hanya BACKLOG/REJECTED. */
  private assertMapEditable(planning: PlanningEntity): void {
    if (!planning.canBeEdited()) {
      throw new PlanningInvalidStateError(
        `Peta rencana berstatus ${planning.status} tidak bisa diubah. Hanya rencana berstatus BACKLOG atau REJECTED yang bisa diubah.`,
      );
    }
  }

  /** Mengambil titik yang benar-benar milik rencana tersebut. */
  private async findNodeOfPlanning(
    nodeId: string,
    planningId: string,
  ): Promise<MappingNode> {
    const node = await this.petaRepo.ambilTitik(nodeId);

    if (!node || node.planningId !== planningId) {
      throw new PlanningNotFoundError("Titik tidak ditemukan");
    }

    return node;
  }

  /** Titik yang sudah terbit menjadi node nyata tidak boleh diubah dari sini. */
  private assertNodeStillPlanned(node: MappingNode): void {
    if (!node.isPlanned) {
      throw new PlanningInvalidStateError(
        "Titik ini sudah terbit menjadi node jaringan nyata dan tidak bisa diubah atau dihapus dari rencana.",
      );
    }
  }

  /** Mengambil jalur yang benar-benar milik rencana tersebut. */
  private async findEdgeOfPlanning(
    edgeId: string,
    planningId: string,
  ): Promise<MappingEdge> {
    const edge = await this.petaRepo.ambilJalur(edgeId);

    if (!edge || edge.planningId !== planningId) {
      throw new PlanningNotFoundError("Jalur tidak ditemukan");
    }

    return edge;
  }

  /** Kedua ujung jalur wajib titik milik rencana yang sama. */
  private async assertEndpointsBelongToPlanning(
    planningId: string,
    sourceId: string,
    targetId: string,
  ): Promise<void> {
    if (sourceId === targetId) {
      throw new PlanningValidationError(
        "Titik asal dan tujuan jalur tidak boleh sama",
      );
    }
    await this.findNodeOfPlanning(sourceId, planningId);
    await this.findNodeOfPlanning(targetId, planningId);
  }

  /** Menambahkan satu titik rencana ke peta planning. */
  async tambahTitik(
    planningId: string,
    input: BuatTitikRencanaInput,
    userId: string,
    tenantId: string,
  ): Promise<TitikRencanaDTO> {
    const planning = await this.findOwnedPlanning(planningId, tenantId);
    this.assertMapEditable(planning);

    const node = await this.unitOfWork.runInTransaction(async (tx) => {
      const created = await this.petaRepo.buatTitik(
        {
          planningId,
          tenantId: planning.tenantId,
          type: input.type,
          name: input.name,
          latitude: input.latitude,
          longitude: input.longitude,
          splitter: input.splitter,
          notes: input.notes ?? null,
        },
        tx as PrismaTx,
      );

      await this.auditService.logChange(
        {
          planningId,
          tenantId: planning.tenantId,
          action: "UPDATED",
          performedById: userId,
          changes: {
            peta: "titik_ditambah",
            nodeId: created.nodeId,
            type: created.type,
            name: created.name,
            splitter: created.splitter,
          },
        },
        tx,
      );

      return created;
    });

    logger.logActivity({
      action: "planning.titik_added",
      subject: "MappingNode",
      details: { planningId, nodeId: node.nodeId },
      userId,
      tenantId: planning.tenantId,
    });

    return PlanningPetaMapper.toTitikDTO(node);
  }

  /** Mengubah satu titik rencana; jenis titik (ODP/ODC) tidak bisa diganti. */
  async ubahTitik(
    planningId: string,
    nodeId: string,
    input: BuatTitikRencanaInput,
    userId: string,
    tenantId: string,
  ): Promise<TitikRencanaDTO> {
    const planning = await this.findOwnedPlanning(planningId, tenantId);
    this.assertMapEditable(planning);

    const existing = await this.findNodeOfPlanning(nodeId, planningId);
    this.assertNodeStillPlanned(existing);

    if (existing.type !== input.type) {
      throw new PlanningValidationError(
        "Jenis titik tidak bisa diganti; hapus lalu buat titik baru",
      );
    }

    const node = await this.unitOfWork.runInTransaction(async (tx) => {
      const updated = await this.petaRepo.ubahTitik(
        nodeId,
        {
          name: input.name,
          latitude: input.latitude,
          longitude: input.longitude,
          splitter: input.splitter,
          notes: input.notes ?? null,
        },
        tx as PrismaTx,
      );

      await this.auditService.logChange(
        {
          planningId,
          tenantId: planning.tenantId,
          action: "UPDATED",
          performedById: userId,
          changes: {
            peta: "titik_diubah",
            nodeId,
            name: existing.name,
            splitterSebelum: existing.splitter,
            splitterSesudah: updated.splitter,
          },
        },
        tx,
      );

      return updated;
    });

    logger.logActivity({
      action: "planning.titik_updated",
      subject: "MappingNode",
      details: { planningId, nodeId },
      userId,
      tenantId: planning.tenantId,
    });

    return PlanningPetaMapper.toTitikDTO(node);
  }

  /** Menghapus satu titik rencana yang belum terbit dan tak punya jalur. */
  async hapusTitik(
    planningId: string,
    nodeId: string,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const planning = await this.findOwnedPlanning(planningId, tenantId);
    this.assertMapEditable(planning);

    const existing = await this.findNodeOfPlanning(nodeId, planningId);
    this.assertNodeStillPlanned(existing);

    const jumlahJalur = await this.petaRepo.hitungJalurTerhubung(nodeId);
    if (jumlahJalur > 0) {
      throw new PlanningInvalidStateError(
        `Titik ini masih terhubung ke ${jumlahJalur} jalur. Hapus jalurnya terlebih dahulu.`,
      );
    }

    await this.unitOfWork.runInTransaction(async (tx) => {
      await this.petaRepo.hapusTitik(nodeId, tx as PrismaTx);

      await this.auditService.logChange(
        {
          planningId,
          tenantId: planning.tenantId,
          action: "UPDATED",
          performedById: userId,
          changes: {
            peta: "titik_dihapus",
            nodeId,
            type: existing.type,
            name: existing.name,
          },
        },
        tx,
      );
    });

    logger.logActivity({
      action: "planning.titik_deleted",
      subject: "MappingNode",
      details: { planningId, nodeId },
      userId,
      tenantId: planning.tenantId,
    });
  }

  /** Menambahkan satu jalur kabel rencana di antara dua titik planning. */
  async tambahJalur(
    planningId: string,
    input: BuatJalurRencanaInput,
    userId: string,
    tenantId: string,
  ): Promise<JalurRencanaDTO> {
    const planning = await this.findOwnedPlanning(planningId, tenantId);
    this.assertMapEditable(planning);
    await this.assertEndpointsBelongToPlanning(
      planningId,
      input.source,
      input.target,
    );

    const edge = await this.unitOfWork.runInTransaction(async (tx) => {
      const created = await this.petaRepo.buatJalur(
        {
          planningId,
          tenantId: planning.tenantId,
          source: input.source,
          target: input.target,
          fiberType: input.fiberType,
          waypoints:
            input.waypoints.length > 0 ? JSON.stringify(input.waypoints) : null,
          distance: input.distance ?? null,
          notes: input.notes ?? null,
        },
        tx as PrismaTx,
      );

      await this.auditService.logChange(
        {
          planningId,
          tenantId: planning.tenantId,
          action: "UPDATED",
          performedById: userId,
          changes: {
            peta: "jalur_ditambah",
            edgeId: created.edgeId,
            source: created.source,
            target: created.target,
            fiberType: created.fiberType,
            distance: created.distance,
          },
        },
        tx,
      );

      return created;
    });

    logger.logActivity({
      action: "planning.jalur_added",
      subject: "MappingEdge",
      details: { planningId, edgeId: edge.edgeId },
      userId,
      tenantId: planning.tenantId,
    });

    return PlanningPetaMapper.toJalurDTO(edge);
  }

  /** Menghapus satu jalur rencana yang belum terbit. */
  async hapusJalur(
    planningId: string,
    edgeId: string,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const planning = await this.findOwnedPlanning(planningId, tenantId);
    this.assertMapEditable(planning);

    const existing = await this.findEdgeOfPlanning(edgeId, planningId);
    if (!existing.isPlanned) {
      throw new PlanningInvalidStateError(
        "Jalur ini sudah terbit menjadi kabel jaringan nyata dan tidak bisa dihapus dari rencana.",
      );
    }

    await this.unitOfWork.runInTransaction(async (tx) => {
      await this.petaRepo.hapusJalur(edgeId, tx as PrismaTx);

      await this.auditService.logChange(
        {
          planningId,
          tenantId: planning.tenantId,
          action: "UPDATED",
          performedById: userId,
          changes: {
            peta: "jalur_dihapus",
            edgeId,
            source: existing.source,
            target: existing.target,
            distance: existing.distance,
          },
        },
        tx,
      );
    });

    logger.logActivity({
      action: "planning.jalur_deleted",
      subject: "MappingEdge",
      details: { planningId, edgeId },
      userId,
      tenantId: planning.tenantId,
    });
  }

  /** Seluruh titik dan jalur rencana sebuah planning (boleh di status apa pun). */
  async ambilPeta(
    planningId: string,
    tenantId: string,
  ): Promise<PetaPlanningDTO> {
    await this.findOwnedPlanning(planningId, tenantId);

    const [titik, jalur] = await Promise.all([
      this.petaRepo.ambilTitikPerPlanning(planningId),
      this.petaRepo.ambilJalurPerPlanning(planningId),
    ]);

    return {
      titik: titik.map((node) => PlanningPetaMapper.toTitikDTO(node)),
      jalur: jalur.map((edge) => PlanningPetaMapper.toJalurDTO(edge)),
    };
  }

  /**
   * Titik rencana tanpa planning induk (planning-nya dihapus, `SetNull`).
   * Tanpa jalur ini node itu tidak terlihat di peta mana pun.
   */
  async ambilTitikYatim(tenantId: string): Promise<TitikRencanaDTO[]> {
    const titik = await this.petaRepo.ambilTitikYatim(tenantId);
    return titik.map((node) => PlanningPetaMapper.toTitikDTO(node));
  }
}
