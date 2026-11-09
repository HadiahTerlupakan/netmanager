import type {
  RestockApprovalBarangLine,
  RestockApprovalBarangRef,
  RestockApprovalJasaLine,
  RestockApprovalPlan,
} from "../restock-approval-decision";

/** Pengajuan restock beserta barisnya, dimuat untuk diputuskan penyetuju. */
export interface RestockRequestForDecision {
  id: string;
  nomorRequest: string;
  status: string;
  barangLines: RestockApprovalBarangLine[];
  jasaLines: RestockApprovalJasaLine[];
}

interface RestockDecisionCommandBase {
  purchaseRequestId: string;
  tenantId: string;
  actorId: string;
  decidedAt: Date;
}

/** Simpan persetujuan beserta keputusan per baris. */
export interface SaveRestockApprovalCommand extends RestockDecisionCommandBase {
  catatan: string | null;
  plan: RestockApprovalPlan;
}

/** Simpan penolakan seluruh pengajuan. */
export interface SaveRestockRejectionCommand extends RestockDecisionCommandBase {
  catatan: string;
}

/** Pengajuan setelah diputuskan, dalam bentuk yang dikirim ke klien. */
export interface RestockDecidedRequest {
  id: string;
  nomorRequest: string;
  status: string;
  [field: string]: unknown;
}

/** Akses data untuk keputusan setuju/tolak pengajuan restock. */
export interface IRestockApprovalRepository {
  /** Muat pengajuan milik tenant beserta baris barang dan jasanya. */
  findRequestForDecision(
    purchaseRequestId: string,
    tenantId: string,
  ): Promise<RestockRequestForDecision | null>;

  /** Cari barang milik tenant berdasarkan id, untuk calon pengganti. */
  findBarangByIds(
    barangIds: string[],
    tenantId: string,
  ): Promise<RestockApprovalBarangRef[]>;

  /**
   * Tulis persetujuan dalam satu transaksi. `false` berarti pengajuan sudah
   * tidak DRAFT atau barisnya berubah sebelum keputusan tersimpan.
   */
  saveApproval(command: SaveRestockApprovalCommand): Promise<boolean>;

  /** Tulis penolakan dalam satu transaksi; `false` bila sudah tidak DRAFT. */
  saveRejection(command: SaveRestockRejectionCommand): Promise<boolean>;

  /** Ambil pengajuan yang baru diputuskan untuk dikirim balik ke klien. */
  findDecidedRequest(
    purchaseRequestId: string,
    tenantId: string,
  ): Promise<RestockDecidedRequest | null>;
}
