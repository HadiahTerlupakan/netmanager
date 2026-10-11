import { randomUUID } from "node:crypto";

import { buildTenantUploadDir } from "@/lib/upload/upload-policy";
import { convertAndSaveImage, saveFile } from "@/lib/utils/image-upload";

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

/**
 * Batas ukuran satu berkas PDF.
 *
 * Lebih longgar daripada foto: izin, berita acara, dan gambar teknis hasil
 * scan rutin melewati 5MB, sementara foto sudah dikonversi ke WebP lebih dulu.
 */
export const BATAS_UKURAN_PDF_BYTE = 15 * 1024 * 1024;

/** Satu-satunya tipe berkas non-gambar yang diterima. */
export const MIME_PDF = "application/pdf";

/** Kategori bagi foto yang tertaut ke titik rencana. */
const KATEGORI_FOTO_TITIK: DocumentCategory = "SURVEY_PHOTO";

/** Kategori bawaan bagi lampiran tingkat proyek tanpa titik. */
const KATEGORI_LAMPIRAN_BAWAAN: DocumentCategory = "OTHER";

/** Menyimpan berkas dan mengembalikan URL-nya. Dipisah agar mudah diganti di tes. */
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
) => {
  const direktori = buildTenantUploadDir(
    `public/uploads/planning/${planningId}`,
    tenantId,
  );
  const dasarNama = `planning_${Date.now()}_${randomUUID().split("-")[0]}`;

  // PDF tidak boleh lewat `convertAndSaveImage`: sharp akan menolaknya, dan
  // kalaupun lolos hasilnya WebP — dokumennya hancur. `saveFile` menyimpan
  // byte-nya apa adanya, ke R2 maupun lokal, lewat namespace tenant yang sama.
  if (file.type === MIME_PDF) {
    return saveFile(
      file,
      direktori,
      `${dasarNama}.pdf`,
      "planning",
      planningId,
    );
  }

  return convertAndSaveImage(
    file,
    direktori,
    dasarNama,
    "planning",
    planningId,
  );
};

/**
 * PlanningDocumentService
 *
 * Unggah gambar atau PDF ke sebuah Planning OSP. Gambar dapat ditautkan ke
 * titik yang berasal dari rencana itu (`nodeId`) sebagai foto survei; tanpa
 * `nodeId` berkas menjadi lampiran tingkat proyek — di situlah izin, berita
 * acara, dan gambar teknis berbentuk PDF tinggal. Titik yang sudah terbit
 * menjadi node jaringan tetap menerima foto — lihat `assertTitikAsalPlanning`.
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
   * Mengunggah gambar atau PDF ke sebuah planning milik tenant pemanggil.
   * Bila `nodeId` diisi, titik wajib berasal dari planning ini (disaring di
   * query repository, terbit maupun belum) dan kategorinya dipaksa
   * `SURVEY_PHOTO`, mengabaikan kategori kiriman klien.
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
      await this.assertTitikAsalPlanning(nodeId, planningId);
    }

    this.assertBerkasValid(input.file, nodeId);

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

  /**
   * Titik yang tidak berasal dari planning ini dianggap tidak ada.
   *
   * Memakai `ambilTitikAsalPlanning` (tanpa penyaring `isPlanned`), bukan
   * `ambilTitikMilikPlanning`. Yang kedua menyaring titik yang sudah terbit,
   * sehingga foto mustahil ditempelkan tepat setelah titiknya dibangun —
   * padahal justru saat itulah foto lapangan ada, dan service ini sengaja
   * tidak mengunci status (lihat docstring kelas). Penyaring tenant tetap
   * dijaga lewat pemeriksaan kepemilikan planning di atas.
   */
  private async assertTitikAsalPlanning(
    nodeId: string,
    planningId: string,
  ): Promise<void> {
    const titik = await this.petaRepo.ambilTitikAsalPlanning(
      nodeId,
      planningId,
    );

    if (!titik) {
      throw new PlanningNotFoundError("Titik tidak ditemukan");
    }
  }

  /** Gambar atau PDF, masing-masing dengan batas ukurannya sendiri. */
  private assertBerkasValid(file: File, nodeId: string | null): void {
    const isGambar = file.type.startsWith("image/");
    const isPdf = file.type === MIME_PDF;

    if (!isGambar && !isPdf) {
      throw new PlanningValidationError("Berkas harus berupa gambar atau PDF");
    }

    // Foto survei menempel pada sebuah TITIK di peta dan ditampilkan sebagai
    // gambar di popup titik; PDF tidak punya tempat di sana.
    if (isPdf && nodeId) {
      throw new PlanningValidationError(
        "Foto survei titik harus berupa gambar, bukan PDF",
      );
    }

    if (isPdf && file.size > BATAS_UKURAN_PDF_BYTE) {
      throw new PlanningValidationError("Ukuran PDF maksimal 15MB");
    }
    if (isGambar && file.size > BATAS_UKURAN_FOTO_BYTE) {
      throw new PlanningValidationError("Ukuran foto maksimal 5MB");
    }
  }
}
