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

  /** Mengambil titik rencana milik planning ini; selain itu dianggap tidak ada. */
  private async findNodeOfPlanning(
    nodeId: string,
    planningId: string,
  ): Promise<MappingNode> {
    const node = await this.petaRepo.ambilTitikMilikPlanning(
      nodeId,
      planningId,
    );

    if (!node) {
      throw new PlanningNotFoundError("Titik tidak ditemukan");
    }

    return node;
  }

  /** Mengambil jalur rencana milik planning ini; selain itu dianggap tidak ada. */
  private async findEdgeOfPlanning(
    edgeId: string,
    planningId: string,
  ): Promise<MappingEdge> {
    const edge = await this.petaRepo.ambilJalurMilikPlanning(
      edgeId,
      planningId,
    );

    if (!edge) {
      throw new PlanningNotFoundError("Jalur tidak ditemukan");
    }

    return edge;
  }

  /**
   * Memastikan titik boleh menjadi ujung jalur. Seluruh aturan (tenant,
   * rencana planning ini atau node nyata, tipe infrastruktur) disaring di
   * query repository; di sini hanya soal ada atau tidak.
   */
  private async assertEndpointAllowed(
    nodeId: string,
    planningId: string,
    tenantId: string,
  ): Promise<void> {
    const node = await this.petaRepo.ambilTitikUjungJalur(
      nodeId,
      planningId,
      tenantId,
    );

    if (!node) {
      throw new PlanningNotFoundError("Titik tidak ditemukan");
    }
  }

  /** Kedua ujung jalur wajib lolos `assertEndpointAllowed` dan berbeda. */
  private async assertEndpointsAllowed(
    planningId: string,
    sourceId: string,
    targetId: string,
    tenantId: string,
  ): Promise<void> {
    if (sourceId === targetId) {
      throw new PlanningValidationError(
        "Titik asal dan tujuan jalur tidak boleh sama",
      );
    }
    await this.assertEndpointAllowed(sourceId, planningId, tenantId);
    await this.assertEndpointAllowed(targetId, planningId, tenantId);
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
    await this.assertEndpointsAllowed(
      planningId,
      input.source,
      input.target,
      planning.tenantId,
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

  /**
   * Seluruh titik dan jalur rencana sebuah planning (boleh di status apa pun).
   *
   * Dengan `sertakanNodeNyata`, jawaban juga memuat node jaringan yang sudah
   * nyata dalam tenant yang sama. Peta perencanaan menampilkannya sebagai
   * latar redup: rencana tanpa konteks jaringan yang sudah berdiri membuat
   * perencana menggambar ODC kedua di tempat yang sudah punya satu, dan
   * node-node itu pula yang boleh menjadi ujung jalur rencana.
   *
   * `diizinkanNodeNyata` dihitung pemanggil, bukan di sini: latar itu adalah
   * inventaris topologi operasional lengkap beserta koordinatnya, jadi tidak
   * boleh ikut hanya karena pemegang izin planning memintanya. Service tidak
   * pernah tahu nama izinnya — ia hanya menerima dua boolean dan menandai
   * hasilnya, sesuai batasan "tiada logika otorisasi di service".
   */
  async ambilPeta(
    planningId: string,
    tenantId: string,
    opsi: { sertakanNodeNyata?: boolean; diizinkanNodeNyata?: boolean } = {},
  ): Promise<PetaPlanningDTO> {
    await this.findOwnedPlanning(planningId, tenantId);

    const diminta = Boolean(opsi.sertakanNodeNyata);
    const bolehDibaca = diminta && Boolean(opsi.diizinkanNodeNyata);

    const [titik, jalur, nodeNyata] = await Promise.all([
      this.petaRepo.ambilTitikPerPlanning(planningId),
      this.petaRepo.ambilJalurPerPlanning(planningId),
      bolehDibaca
        ? this.petaRepo.ambilNodeNyataInfrastruktur(tenantId)
        : Promise.resolve([] as MappingNode[]),
    ]);

    return {
      titik: titik.map((node) => PlanningPetaMapper.toTitikDTO(node)),
      jalur: jalur.map((edge) => PlanningPetaMapper.toJalurDTO(edge)),
      nodeNyata: nodeNyata.map((node) => PlanningPetaMapper.toTitikDTO(node)),
      latarDisembunyikanKarenaIzin: diminta && !bolehDibaca,
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
