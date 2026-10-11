import { randomUUID } from "node:crypto";

import { buildTenantUploadDir } from "@/lib/upload/upload-policy";
import { convertAndSaveImage } from "@/lib/utils/image-upload";

import type { DocumentCategory } from "../domain/entities/PlanningDocumentEntity";
import type { IPlanningDocumentRepository } from "../domain/ports/IPlanningDocumentRepository";
import type { IPlanningRepository } from "../domain/ports/IPlanningRepository";
import type { PlanningDocumentDTO } from "../dto/PlanningDocumentDTO";
import {
  PlanningNotFoundError,
  PlanningValidationError,
} from "../errors/planning-errors";
import { PlanningDocumentMapper } from "../mappers/PlanningDocumentMapper";
import type { PlanningPetaRepository } from "../repositories/PlanningPetaRepository";
import type { PlanningAuditService } from "./PlanningAuditService";

/** Batas ukuran satu foto, sama dengan unggah foto node peta. */
export const BATAS_UKURAN_FOTO_BYTE = 5 * 1024 * 1024;

/** Kategori bagi foto yang tertaut ke titik rencana. */
const KATEGORI_FOTO_TITIK: DocumentCategory = "SURVEY_PHOTO";

/** Kategori bawaan bagi lampiran tingkat proyek tanpa titik. */
const KATEGORI_LAMPIRAN_BAWAAN: DocumentCategory = "OTHER";

/** Menyimpan gambar dan mengembalikan URL-nya. Dipisah agar mudah diganti di tes. */
export type SimpanGambarPlanning = (
  file: File,
  planningId: string,
  tenantId: string,
) => Promise<string>;

/** Berkas yang diunggah beserta metadatanya. */
export interface UnggahDokumenPlanningInput {
  file: File;
  nodeId?: string | null;
  category?: DocumentCategory;
  description?: string | null;
}

/**
 * Penyimpan bawaan: pembungkus `convertAndSaveImage` yang sama dengan unggah
 * foto node peta (konversi WebP, R2 bila aktif, namespace per tenant).
 */
export const simpanGambarPlanning: SimpanGambarPlanning = (
  file,
  planningId,
  tenantId,
) =>
  convertAndSaveImage(
    file,
    buildTenantUploadDir(`public/uploads/planning/${planningId}`, tenantId),
    `planning_${Date.now()}_${randomUUID().split("-")[0]}`,
    "planning",
    planningId,
  );

/**
 * PlanningDocumentService
 *
 * Unggah gambar dokumen sebuah Planning OSP. Foto dapat ditautkan ke titik
 * rencananya (`nodeId`) sebagai foto survei; tanpa `nodeId` berkas menjadi
 * lampiran tingkat proyek.
 *
 * Tidak ada kunci status rencana pada unggahan: item dan milestone dikunci
 * karena mengubah angka yang sudah disetujui, sedangkan dokumen hanyalah
 * lampiran bukti yang tidak mengubah anggaran, dan `COMPLETION_PHOTO` memang
 * diunggah setelah pekerjaan selesai. Ini disengaja, bukan kelalaian.
 */
export class PlanningDocumentService {
  constructor(
    private readonly planningRepo: IPlanningRepository,
    private readonly documentRepo: IPlanningDocumentRepository,
    private readonly petaRepo: PlanningPetaRepository,
    private readonly auditService: PlanningAuditService,
    private readonly simpanGambar: SimpanGambarPlanning = simpanGambarPlanning,
  ) {}

  /**
   * Mengunggah gambar ke sebuah planning milik tenant pemanggil.
   * Bila `nodeId` diisi, titik wajib titik rencana milik planning ini
   * (disaring di query repository) dan kategorinya dipaksa `SURVEY_PHOTO`,
   * mengabaikan kategori kiriman klien.
   */
  async upload(
    planningId: string,
    input: UnggahDokumenPlanningInput,
    userId: string,
    tenantId: string,
  ): Promise<PlanningDocumentDTO> {
    const planning = await this.planningRepo.findById(planningId);
    if (!planning || planning.tenantId !== tenantId) {
      throw new PlanningNotFoundError();
    }

    const nodeId = input.nodeId ?? null;
    if (nodeId) {
      await this.assertTitikMilikPlanning(nodeId, planningId);
    }

    this.assertBerkasValid(input.file);

    const fileUrl = await this.simpanGambar(input.file, planningId, tenantId);
    const created = await this.documentRepo.create({
      planningId,
      tenantId,
      filename: input.file.name,
      fileUrl,
      fileSize: input.file.size,
      mimeType: input.file.type,
      category: nodeId
        ? KATEGORI_FOTO_TITIK
        : (input.category ?? KATEGORI_LAMPIRAN_BAWAAN),
      description: input.description ?? null,
      uploadedById: userId,
      nodeId,
    });

    await this.auditService.logChange({
      planningId,
      tenantId,
      action: "DOCUMENT_UPLOADED",
      performedById: userId,
      changes: {
        documentId: created.id,
        filename: created.filename,
        category: created.category,
        nodeId,
      },
    });

    return PlanningDocumentMapper.toDTO(created);
  }

  /** Titik yang bukan titik rencana planning ini dianggap tidak ada. */
  private async assertTitikMilikPlanning(
    nodeId: string,
    planningId: string,
  ): Promise<void> {
    const titik = await this.petaRepo.ambilTitikMilikPlanning(
      nodeId,
      planningId,
    );

    if (!titik) {
      throw new PlanningNotFoundError("Titik tidak ditemukan");
    }
  }

  /** Hanya gambar, dan tidak melebihi batas ukuran. */
  private assertBerkasValid(file: File): void {
    if (!file.type.startsWith("image/")) {
      throw new PlanningValidationError("Berkas harus berupa gambar");
    }
    if (file.size > BATAS_UKURAN_FOTO_BYTE) {
      throw new PlanningValidationError("Ukuran foto maksimal 5MB");
    }
  }
}
