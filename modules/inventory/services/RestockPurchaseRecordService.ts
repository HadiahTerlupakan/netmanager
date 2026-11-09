import {
  getEarliestLinkPurchaseDate,
  PURCHASE_LINK_MESSAGES,
} from "../domain/restock-purchase-link";
import {
  isRequestFullyPurchased,
  planPurchaseRecord,
  resolvePurchaseDate,
  RESTOCK_PURCHASE_MESSAGES,
} from "../domain/restock-purchase-record";
import type {
  CreatePurchaseRecordInput,
  CreatePurchaseRecordLine,
  IRestockPurchaseRecordRepository,
  RestockPurchaseContext,
  RestockPurchaseRecordView,
  VoidPurchaseRecordOutcome,
} from "../domain/ports/IRestockPurchaseRecordRepository";
import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "./inventory-activity-log";
import { RESTOCK_MESSAGES } from "./restock-messages";

export type { RestockPurchaseRecordView } from "../domain/ports/IRestockPurchaseRecordRepository";

/**
 * Asal catatan belanja: pembeli lewat link tanpa login. Catatan tetap punya
 * penanggung jawab internal (pembuat link) di `recordedById`; identitas
 * pembeli ada di `buyerName` & tanda tangan.
 */
export interface PurchaseRecordOrigin {
  linkId: string;
  linkCreatorId: string;
  /** Tanggal belanja lewat link tidak boleh jauh sebelum link dibuat. */
  linkCreatedAt: Date;
  buyerName: string;
  signatureKey: string;
  clientRequestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}

/** Isian satu catatan belanja. */
export interface RecordRestockPurchaseCommand {
  purchaseRequestId: string;
  tenantId: string;
  origin: PurchaseRecordOrigin;
  /** Tanggal belanja "YYYY-MM-DD". */
  purchasedAt: string;
  notes: string | null;
  items: Array<{
    purchaseOrderItemId: string;
    quantity: number;
    unitPrice: number | null;
  }>;
}

export type RestockPurchaseRecordErrorCode =
  | "INVALID"
  | "NOT_FOUND"
  | "CONFLICT"
  /** Link dicabut/kedaluwarsa saat dicatat. */
  | "LINK_INACTIVE"
  /** Link sudah mencapai batas jumlah catatan. */
  | "LIMIT_REACHED";

export type RestockPurchaseRecordResult =
  | {
      success: true;
      data: {
        record: RestockPurchaseRecordView;
        purchaseOrderStatus: string;
        isFullyPurchased: boolean;
        message: string;
        /** True bila ini kiriman ulang; catatan lama dikembalikan. */
        isReplay: boolean;
      };
    }
  | { success: false; code: RestockPurchaseRecordErrorCode; error: string };

/** Isian pembatalan satu catatan belanja oleh admin. */
export interface VoidRestockPurchaseCommand {
  purchaseRequestId: string;
  recordId: string;
  tenantId: string;
  actorId: string;
  reason: string;
}

export type VoidRestockPurchaseErrorCode = "NOT_FOUND" | "CONFLICT";

export type VoidRestockPurchaseResult =
  | {
      success: true;
      data: { record: RestockPurchaseRecordView; message: string };
    }
  | { success: false; code: VoidRestockPurchaseErrorCode; error: string };

function fail(
  code: RestockPurchaseRecordErrorCode,
  error: string,
): RestockPurchaseRecordResult {
  return { success: false, code, error };
}

/** Belanja lewat link tidak boleh bertanggal sebelum daftarnya dikirim. */
function isBeforeLinkCreated(command: RecordRestockPurchaseCommand): boolean {
  return (
    command.purchasedAt <
    getEarliestLinkPurchaseDate(command.origin.linkCreatedAt)
  );
}

/**
 * Mencatat belanja restock, hanya lewat link belanja. Satu pengajuan
 * tetap satu pesanan dan satu tagihan; catatan ini hanya merekam barang mana
 * dibeli, kapan, dan oleh siapa.
 */
export class RestockPurchaseRecordService {
  constructor(
    private readonly repository: IRestockPurchaseRecordRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Catat satu kali belanja untuk pengajuan restock. */
  async recordPurchase(
    command: RecordRestockPurchaseCommand,
  ): Promise<RestockPurchaseRecordResult> {
    const purchasedAt = resolvePurchaseDate(command.purchasedAt, this.now());
    if (!purchasedAt) {
      return fail("INVALID", RESTOCK_PURCHASE_MESSAGES.futureDate);
    }
    if (isBeforeLinkCreated(command)) {
      return fail("INVALID", PURCHASE_LINK_MESSAGES.dateBeforeLink);
    }

    const context = await this.repository.findPurchaseContext(
      command.purchaseRequestId,
      command.tenantId,
    );
    if (!context) return fail("NOT_FOUND", RESTOCK_MESSAGES.requestNotFound);
    if (!context.request.purchaseOrderId) {
      return fail("INVALID", RESTOCK_MESSAGES.noPurchaseOrderYet);
    }
    const purchaseOrder = context.purchaseOrder;
    if (!purchaseOrder) {
      return fail("NOT_FOUND", RESTOCK_MESSAGES.purchaseOrderNotFound);
    }
    // Data lama sudah dibeli lewat alur lama; laporan baru akan menghapus
    // pengecualiannya dan mencatat belanja dua kali.
    if (purchaseOrder.isLegacyPurchased) {
      return fail("LINK_INACTIVE", RESTOCK_PURCHASE_MESSAGES.legacyPurchased);
    }

    const plan = planPurchaseRecord(
      { request: context.request, purchaseOrder },
      command.items,
    );
    if (plan.ok === false) return fail(plan.code, plan.error);

    const outcome = await this.repository.createPurchaseRecord(
      buildCreateInput(command, {
        context,
        purchaseOrderId: purchaseOrder.id,
        purchasedAt,
        lines: plan.lines,
        now: this.now(),
      }),
    );
    if (outcome.kind === "CLOSED") {
      return fail("CONFLICT", RESTOCK_PURCHASE_MESSAGES.closed);
    }
    if (outcome.kind === "CONFLICT") {
      return fail("CONFLICT", RESTOCK_PURCHASE_MESSAGES.conflict);
    }
    if (outcome.kind === "LINK_INACTIVE") {
      return fail("LINK_INACTIVE", RESTOCK_PURCHASE_MESSAGES.closed);
    }
    if (outcome.kind === "LINK_LIMIT") {
      return fail("LIMIT_REACHED", PURCHASE_LINK_MESSAGES.recordLimitReached);
    }
    if (outcome.kind === "DUPLICATE") {
      return this.describeReplay(command, outcome.record, purchaseOrder.status);
    }

    this.logPurchase(command, purchaseOrder.poNumber, plan.lines, outcome);

    const isFullyPurchased = isRequestFullyPurchased(
      outcome.items,
      context.request.receivableBarangIds,
    );
    return {
      success: true,
      data: {
        record: outcome.record,
        purchaseOrderStatus: outcome.purchaseOrderStatus,
        isFullyPurchased,
        message: isFullyPurchased
          ? RESTOCK_PURCHASE_MESSAGES.savedAll
          : RESTOCK_PURCHASE_MESSAGES.savedPartial,
        isReplay: false,
      },
    };
  }

  /**
   * Batalkan catatan belanja yang salah atau tidak sah (mis. diisi pemegang
   * link yang tidak berhak). Catatan tetap disimpan untuk jejak audit; jumlah
   * dibelinya dikembalikan jadi belum dibeli.
   */
  async voidPurchase(
    command: VoidRestockPurchaseCommand,
  ): Promise<VoidRestockPurchaseResult> {
    const outcome = await this.repository.voidPurchaseRecord({
      ...command,
      now: this.now(),
    });
    switch (outcome.kind) {
      case "NOT_FOUND":
        return {
          success: false,
          code: "NOT_FOUND",
          error: RESTOCK_PURCHASE_MESSAGES.recordNotFound,
        };
      case "ALREADY_VOIDED":
        return {
          success: false,
          code: "CONFLICT",
          error: RESTOCK_PURCHASE_MESSAGES.alreadyVoided,
        };
      case "SHARED_WITH_OTHER_REQUEST":
        return {
          success: false,
          code: "CONFLICT",
          error: RESTOCK_PURCHASE_MESSAGES.voidSharedRecord,
        };
      case "CLOSED":
        return {
          success: false,
          code: "CONFLICT",
          error: RESTOCK_PURCHASE_MESSAGES.voidClosed,
        };
      case "ALREADY_RECEIVED":
        return {
          success: false,
          code: "CONFLICT",
          error: RESTOCK_PURCHASE_MESSAGES.voidAlreadyReceived(
            outcome.lines
              .map((line) =>
                [line.nama, line.received, line.satuan, "sudah datang"]
                  .filter((part) => part !== null && part !== "")
                  .join(" "),
              )
              .join(", "),
          ),
        };
      case "VOIDED":
        this.logVoid(command, outcome);
        return {
          success: true,
          data: {
            record: outcome.record,
            message: RESTOCK_PURCHASE_MESSAGES.voided,
          },
        };
    }
  }

  /**
   * Log pembatalan memuat salinan lengkap catatannya (termasuk kunci tanda
   * tangan, IP, dan perangkat pembeli): catatan batal ikut terhapus bila
   * pesanannya dihapus, dan log ini yang tersisa sebagai jejak audit.
   */
  private logVoid(
    command: VoidRestockPurchaseCommand,
    outcome: Extract<VoidPurchaseRecordOutcome, { kind: "VOIDED" }>,
  ): void {
    const { record, audit, poNumber } = outcome;
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.VOID_PURCHASE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.PURCHASE_ORDER,
      reference: poNumber,
      actorId: command.actorId,
      tenantId: command.tenantId,
      details: {
        purchaseRequestId: command.purchaseRequestId,
        purchaseRecordId: record.id,
        toko: record.storeName,
        namaPembeli: record.buyerName,
        lewatLink: record.source === "PUBLIC_LINK",
        alasan: command.reason,
        tanggalBelanja: record.purchasedAt.toISOString(),
        dicatatPada: record.createdAt.toISOString(),
        supplierId: record.supplierId,
        catatan: record.notes,
        fotoNota: record.fotoNota,
        purchaseLinkId: audit.purchaseLinkId,
        clientRequestId: audit.clientRequestId,
        kunciTandaTangan: audit.buyerSignatureKey,
        ipPembeli: audit.ipAddress,
        perangkatPembeli: audit.userAgent,
        barang: record.items.map((line) => ({
          barangId: line.barangId,
          purchaseOrderItemId: line.purchaseOrderItemId,
          nama: line.nama,
          jumlah: line.quantity,
          hargaSatuan: line.unitPrice,
        })),
      },
    });
  }

  /**
   * Kiriman ulang yang kalah balapan dengan kiriman pertama: status daftar
   * dihitung ulang dari data terbaru, karena kiriman pertama bisa saja sudah
   * melengkapi seluruh daftar.
   */
  private async describeReplay(
    command: RecordRestockPurchaseCommand,
    record: RestockPurchaseRecordView,
    previousOrderStatus: string,
  ): Promise<RestockPurchaseRecordResult> {
    const fresh = await this.repository.findPurchaseContext(
      command.purchaseRequestId,
      command.tenantId,
    );
    const isFullyPurchased = fresh?.purchaseOrder
      ? isRequestFullyPurchased(
          fresh.purchaseOrder.items,
          fresh.request.receivableBarangIds,
        )
      : false;
    return {
      success: true,
      data: {
        record,
        purchaseOrderStatus:
          fresh?.purchaseOrder?.status ?? previousOrderStatus,
        isFullyPurchased,
        message: isFullyPurchased
          ? RESTOCK_PURCHASE_MESSAGES.savedAll
          : RESTOCK_PURCHASE_MESSAGES.savedPartial,
        isReplay: true,
      },
    };
  }

  private logPurchase(
    command: RecordRestockPurchaseCommand,
    poNumber: string,
    lines: CreatePurchaseRecordLine[],
    outcome: {
      record: RestockPurchaseRecordView;
      previousStatus: string;
      purchaseOrderStatus: string;
      revokedLinkCount: number;
    },
  ): void {
    const { origin } = command;
    // Tanpa token, hash, maupun kunci tanda tangan.
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.RECORD_PURCHASE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.PURCHASE_ORDER,
      reference: poNumber,
      tenantId: command.tenantId,
      externalActor: { type: "purchase_link", id: origin.linkId },
      ipAddress: origin.ipAddress,
      userAgent: origin.userAgent,
      details: {
        purchaseRequestId: command.purchaseRequestId,
        purchaseRecordId: outcome.record.id,
        tanggalBelanja: command.purchasedAt,
        barang: lines.map((line) => ({
          barangId: line.barangId,
          jumlah: line.quantity,
          hargaSatuan: line.unitPrice,
        })),
        statusLama: outcome.previousStatus,
        statusBaru: outcome.purchaseOrderStatus,
        ...(outcome.revokedLinkCount > 0
          ? { linkBelanjaDimatikan: outcome.revokedLinkCount }
          : {}),
        lewatLink: true,
        namaPembeli: origin.buyerName,
        linkId: origin.linkId,
        keterangan: `Dicatat lewat link belanja oleh ${origin.buyerName}`,
      },
    });
  }
}

interface CreateInputParts {
  context: RestockPurchaseContext;
  purchaseOrderId: string;
  purchasedAt: Date;
  lines: CreatePurchaseRecordLine[];
  now: Date;
}

/** Susun isian tulis untuk catatan belanja lewat link. */
function buildCreateInput(
  command: RecordRestockPurchaseCommand,
  parts: CreateInputParts,
): CreatePurchaseRecordInput {
  const { origin } = command;
  return {
    purchaseOrderId: parts.purchaseOrderId,
    purchaseRequestId: command.purchaseRequestId,
    receivableBarangIds: parts.context.request.receivableBarangIds,
    tenantId: command.tenantId,
    purchasedAt: parts.purchasedAt,
    notes: command.notes,
    lines: parts.lines,
    // Tanggal dari link diisi pihak luar; tanggal beli pesanan memakai waktu
    // server supaya tidak bisa dimundurkan.
    issuedAt: parts.now,
    recordedById: origin.linkCreatorId,
    buyerName: origin.buyerName,
    buyerSignatureKey: origin.signatureKey,
    purchaseLinkId: origin.linkId,
    clientRequestId: origin.clientRequestId,
    ipAddress: origin.ipAddress,
    userAgent: origin.userAgent,
  };
}
