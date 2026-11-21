import {
  GoodsReceiptExceedsRemainingError,
  GoodsReceiptInvalidError,
  PurchaseOrderNotFoundError,
  PurchaseRequestAlreadyOrderedError,
  PurchaseRequestNotOrderableError,
  SupplierNotActiveError,
  type GoodsReceiptEntity,
} from "@/modules/procurement";

import type {
  IRestockGoodsReceiptRepository,
  PurchaseOrderIncreaseUndo,
  RestockPurchaseOrderForReceipt,
} from "../domain/ports/IRestockGoodsReceiptRepository";
import type { IRestockRequestLock } from "../domain/ports/IRestockRequestLock";
import { hasRestockEnteredAnything } from "../domain/restock-request-status";
import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "./inventory-activity-log";
import {
  RestockSubstitutionInvalidError,
  type RestockItemSubstitutionService,
  type RestockSubstitutionMap,
} from "./RestockItemSubstitutionService";
import type { RestockPurchaseOrderGenerator } from "./RestockRequestLifecycleService";
import {
  RestockRequestClosure,
  type RestockEntryClosing,
} from "./RestockRequestClosure";
import {
  ENTRY_NOT_FINISHED_MESSAGE,
  PURCHASE_ORDER_NOT_GENERATED_MESSAGE,
  PURCHASE_ORDER_SUPPLIER_INACTIVE_MESSAGE,
  RECEIPT_CONCURRENT_CHANGE_MESSAGE,
  RECEIPT_MISMATCH_MESSAGE,
  receiptFailure,
  type ReceiveRestockRequestInput,
  type RestockNotEnteredLine,
  type RestockReceiptFailure,
  type RestockReceiptOutcome,
} from "./restock-goods-receipt.contracts";
import {
  describeEntryBlocker,
  planRestockEntry,
  type RestockEntryPlan,
  type RestockEntryPlanResult,
} from "./restock-entry-plan";
import { RESTOCK_MESSAGES } from "./restock-messages";
import { describeOverReceipts } from "./restock-over-receipt";
import {
  getEntryItems,
  loadRestockRequestSnapshot,
  type RestockRequestSnapshot,
  type RestockRequestSnapshotLoad,
} from "./restock-receipt-context";
import { withRestockRequestLock } from "./restock-request-lock";

export {
  ENTRY_LINES_MISMATCH_MESSAGE,
  ENTRY_NOT_FINISHED_MESSAGE,
  ENTRY_PHOTO_MISSING_MESSAGE,
  NOTHING_ENTERED_MESSAGE,
  PURCHASE_ORDER_NOT_GENERATED_MESSAGE,
  RECEIPT_CONCURRENT_CHANGE_MESSAGE,
  type ReceiveRestockRequestInput,
  type RestockNotEnteredLine,
  type RestockReceiptErrorCode,
  type RestockReceiptFailure,
  type RestockReceiptOutcome,
  type RestockReceiptResult,
} from "./restock-goods-receipt.contracts";

/** Satu barang di catatan barang masuk (GRN). */
export interface RestockGoodsReceiptLine {
  purchaseOrderItemId: string;
  barangId: string;
  quantity: number;
}

/** Isian catatan barang masuk untuk pesanan pengajuan. */
export interface RestockGoodsReceiptInput {
  purchaseOrderId: string;
  gudangId: string;
  receivedById: string;
  tenantId: string;
  fotoBukti: string[];
  notes: string;
  items: RestockGoodsReceiptLine[];
}

/** Pembuat catatan barang masuk (GRN); dipenuhi procurement lewat factory. */
export interface RestockGoodsReceiptCreator {
  create(input: RestockGoodsReceiptInput): Promise<GoodsReceiptEntity>;
}

/** Dependency Masukkan Barang; dirakit `createRestockGoodsReceiptService`. */
export interface RestockGoodsReceiptDependencies {
  repository: IRestockGoodsReceiptRepository;
  substitutionService: RestockItemSubstitutionService;
  purchaseOrderGenerator: RestockPurchaseOrderGenerator;
  goodsReceiptCreator: RestockGoodsReceiptCreator;
  lock: IRestockRequestLock;
}

/** Isian yang sudah lolos pemeriksaan, atas pesanan yang pasti ada. */
interface EntryContext {
  input: ReceiveRestockRequestInput;
  snapshot: RestockRequestSnapshot;
  order: RestockPurchaseOrderForReceipt;
  plan: RestockEntryPlan;
  /** Pesanan baru dibuat di penyimpanan ini karena gagal dibuat saat persetujuan. */
  isOrderCreated: boolean;
}

type StepResult<T> = { success: true; data: T } | RestockReceiptFailure;

/** Penutupan sesudah barang dimasukkan, atau alasan pengajuan belum tertutup. */
type EntryClosingAttempt =
  | Extract<RestockEntryClosing, { isWritten: true }>
  | { isWritten: false; failure: RestockReceiptFailure };

/**
 * Masukkan Barang pada pengajuan restock yang sudah disetujui. Sekali simpan
 * langsung menyelesaikan pengajuan: barang yang masuk dicatat lewat GRN (stok,
 * dokumen, dan jurnal ikut tercatat), sisanya dicoret, dan pengajuan menjadi
 * Sudah Dimasukkan.
 */
export class RestockGoodsReceiptService {
  private readonly closure: RestockRequestClosure;

  constructor(private readonly dependencies: RestockGoodsReceiptDependencies) {
    this.closure = new RestockRequestClosure(dependencies.repository);
  }

  /**
   * Masukkan barang lalu selesaikan pengajuan, di bawah kunci pengajuan.
   * Semua isian diperiksa sebelum apa pun ditulis, termasuk sebelum pesanan
   * dibuat untuk pengajuan yang belum punya pesanan.
   */
  async receive(
    input: ReceiveRestockRequestInput,
  ): Promise<RestockReceiptOutcome> {
    return withRestockRequestLock(
      this.dependencies.lock,
      input.purchaseRequestId,
      () => this.receiveUnderLock(input),
    );
  }

  private async receiveUnderLock(
    input: ReceiveRestockRequestInput,
  ): Promise<RestockReceiptOutcome> {
    const loaded = await this.loadSnapshot(input);
    if (loaded.success === false) return loaded;
    const planned = await this.checkEntry(input, loaded.data);
    if (planned.success === false) return planned;
    const { order } = loaded.data;
    if (!order) return this.enterGoodsOnNewOrder(input);
    return this.enterGoods({
      input,
      snapshot: loaded.data,
      order,
      plan: planned.data,
      isOrderCreated: false,
    });
  }

  private loadSnapshot(
    input: ReceiveRestockRequestInput,
  ): Promise<RestockRequestSnapshotLoad> {
    return loadRestockRequestSnapshot(
      this.dependencies.repository,
      input.purchaseRequestId,
      input.tenantId,
    );
  }

  /** Pengajuan boleh dimasukkan barangnya, lalu isiannya diperiksa. */
  private async checkEntry(
    input: ReceiveRestockRequestInput,
    snapshot: RestockRequestSnapshot,
  ): Promise<RestockEntryPlanResult> {
    const blocker = describeEntryBlocker(snapshot.status);
    if (blocker) return receiptFailure("CONFLICT", blocker);
    return this.planEntry(input, snapshot);
  }

  /**
   * Periksa isian terhadap item pesanan milik pengajuan. Tanpa pesanan, barang
   * pengganti juga diperiksa di sini supaya pesanan tidak dibuat untuk isian
   * yang akan ditolak; dengan pesanan, pemeriksaan itu terjadi saat diterapkan.
   */
  private async planEntry(
    input: ReceiveRestockRequestInput,
    snapshot: RestockRequestSnapshot,
  ): Promise<RestockEntryPlanResult> {
    const items = getEntryItems(snapshot);
    const planned = planRestockEntry({
      items,
      input,
      hasEnteredAnything: hasRestockEnteredAnything(snapshot.status),
    });
    if (planned.success === false || snapshot.order) return planned;
    const checked = await runSubstitutionStep(() =>
      this.dependencies.substitutionService.validate({
        purchaseOrderItems: items,
        substitutions: input.substitutions,
        tenantId: input.tenantId,
      }),
    );
    return checked.success === false ? checked : planned;
  }

  /**
   * Pengajuan yang pesanannya gagal dibuat saat persetujuan: pesanan dibuat
   * lewat jalur yang sama, lalu isian diperiksa ulang terhadap pesanan itu.
   */
  private async enterGoodsOnNewOrder(
    input: ReceiveRestockRequestInput,
  ): Promise<RestockReceiptOutcome> {
    const creationFailure = await this.createPurchaseOrder(input);
    if (creationFailure) return creationFailure;

    const reloaded = await this.loadSnapshot(input);
    if (reloaded.success === false) return reloaded;
    const { order } = reloaded.data;
    if (!order) {
      return receiptFailure("FAILED", PURCHASE_ORDER_NOT_GENERATED_MESSAGE);
    }
    const planned = await this.checkEntry(input, reloaded.data);
    if (planned.success === false) return planned;
    return this.enterGoods({
      input,
      snapshot: reloaded.data,
      order,
      plan: planned.data,
      isOrderCreated: true,
    });
  }

  /** Buat pesanan pengajuan lewat `generatePOFromPRs`; null bila berhasil. */
  private async createPurchaseOrder(
    input: ReceiveRestockRequestInput,
  ): Promise<RestockReceiptFailure | null> {
    try {
      const created =
        await this.dependencies.purchaseOrderGenerator.generatePOFromPRs(
          [input.purchaseRequestId],
          input.actorId,
        );
      return created.length > 0
        ? null
        : receiptFailure("FAILED", PURCHASE_ORDER_NOT_GENERATED_MESSAGE);
    } catch (error: unknown) {
      return toPurchaseOrderCreationFailure(error);
    }
  }

  /**
   * Langkah tulis: ganti barang, naikkan pesanan untuk kelebihan, catat GRN,
   * lalu tutup pengajuan. GRN dibuat sebelum sisa dicoret karena GRN
   * mensyaratkan sisa pesanan masih ada. Setiap GRN yang tersimpan dicatat di
   * Log Aktivitas, termasuk bila penutupannya gagal.
   */
  private async enterGoods(
    context: EntryContext,
  ): Promise<RestockReceiptOutcome> {
    const substituted = await runSubstitutionStep(() =>
      this.applySubstitutions(context),
    );
    if (substituted.success === false) return substituted;

    const lines = toGoodsReceiptLines(context.plan, substituted.data);
    const increase = await this.increaseOrderForOverReceipts(context);
    const recorded = await this.recordGoodsReceipt(context, lines, increase);
    if (recorded.success === false) return recorded;

    const closing = await this.closeAfterEntry(context, lines, recorded.data);
    if (recorded.data || closing.isWritten) {
      this.logEntry(context, lines, recorded.data, closing);
    }
    if (closing.isWritten === false) return closing.failure;
    return {
      success: true,
      data: {
        goodsReceipt: recorded.data,
        purchaseRequestStatus: "RECEIVED",
        notEntered: closing.notEntered,
      },
    };
  }

  /**
   * Tutup pengajuan sesudah barang dimasukkan. Bila GRN sudah tersimpan,
   * penutupan yang gagal (datanya berubah, atau gangguan server) tidak
   * dilempar: barangnya sudah di gudang, jadi admin diarahkan menyelesaikan
   * pengajuan tanpa memasukkan barang yang sama lagi. Tanpa GRN tidak ada yang
   * tertulis, jadi gangguan server dilempar ulang dan aman dicoba lagi.
   */
  private async closeAfterEntry(
    context: EntryContext,
    lines: RestockGoodsReceiptLine[],
    goodsReceipt: GoodsReceiptEntity | null,
  ): Promise<EntryClosingAttempt> {
    try {
      const closing = await this.closure.finishAfterEntry({
        snapshot: context.snapshot,
        order: context.order,
        enteredByItemId: new Map(
          lines.map((line) => [line.purchaseOrderItemId, line.quantity]),
        ),
        extraByItemId: new Map(
          context.plan.overReceipts.map((item) => [
            item.purchaseOrderItemId,
            item.extraQuantity,
          ]),
        ),
        actorId: context.input.actorId,
      });
      if (closing.isWritten) return closing;
      return notClosed(
        goodsReceipt
          ? ENTRY_NOT_FINISHED_MESSAGE
          : RECEIPT_CONCURRENT_CHANGE_MESSAGE,
      );
    } catch (error: unknown) {
      if (!goodsReceipt) throw error;
      return notClosed(ENTRY_NOT_FINISHED_MESSAGE, error);
    }
  }

  private applySubstitutions(
    context: EntryContext,
  ): Promise<RestockSubstitutionMap> {
    const { input, snapshot, order } = context;
    return this.dependencies.substitutionService.apply({
      purchaseOrderId: order.id,
      purchaseOrderItems: order.items,
      substitutions: input.substitutions,
      tenantId: input.tenantId,
      actorId: input.actorId,
      referenceNumber: snapshot.request.nomorRequest,
    });
  }

  /** Kelebihan dinaikkan ke pesanan sebelum GRN, karena GRN menolak jumlah di atas sisa. */
  private async increaseOrderForOverReceipts(
    context: EntryContext,
  ): Promise<PurchaseOrderIncreaseUndo | null> {
    const { overReceipts } = context.plan;
    if (overReceipts.length === 0) return null;
    return this.dependencies.repository.increaseItemQuantities({
      purchaseOrderId: context.order.id,
      increases: overReceipts.map((item) => ({
        purchaseOrderItemId: item.purchaseOrderItemId,
        extraQuantity: item.extraQuantity,
      })),
    });
  }

  /**
   * Catat barang masuk. Tanpa jumlah yang masuk (pengajuan lama diselesaikan
   * tanpa barang tambahan) tidak ada GRN. Gangguan tak terduga dilempar ulang
   * setelah kenaikan pesanan dikembalikan.
   */
  private async recordGoodsReceipt(
    context: EntryContext,
    lines: RestockGoodsReceiptLine[],
    increase: PurchaseOrderIncreaseUndo | null,
  ): Promise<StepResult<GoodsReceiptEntity | null>> {
    if (lines.length === 0) return { success: true, data: null };
    try {
      const goodsReceipt = await this.dependencies.goodsReceiptCreator.create({
        purchaseOrderId: context.order.id,
        gudangId: context.snapshot.request.gudangId,
        receivedById: context.input.actorId,
        tenantId: context.input.tenantId,
        fotoBukti: context.input.fotoBukti,
        notes: describeGoodsReceiptNotes(context),
        items: lines,
      });
      return { success: true, data: goodsReceipt };
    } catch (error: unknown) {
      // Kenaikan jumlah pesanan hanya sah bila GRN-nya ada; tanpa ini pesanan
      // dan tagihan supplier tetap membengkak setelah penerimaan gagal.
      if (increase) {
        await this.dependencies.repository.undoItemQuantityIncrease(increase);
      }
      const failure = toGoodsReceiptFailure(error);
      if (!failure) throw error;
      return failure;
    }
  }

  /**
   * Catat RECEIVE: barang yang masuk (GRN) dan, bila pengajuannya sudah
   * tertutup, sisa yang dicoret. `pengajuanSelesai: false` menandai GRN yang
   * tersimpan tetapi pengajuannya belum tertutup.
   */
  private logEntry(
    context: EntryContext,
    lines: RestockGoodsReceiptLine[],
    goodsReceipt: GoodsReceiptEntity | null,
    closing: EntryClosingAttempt,
  ): void {
    const { input, snapshot, order, plan } = context;
    const notEntered: RestockNotEnteredLine[] = closing.isWritten
      ? closing.notEntered
      : [];
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.RECEIVE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.RESTOCK_REQUEST,
      reference: snapshot.request.nomorRequest,
      actorId: input.actorId,
      tenantId: input.tenantId,
      details: {
        purchaseRequestId: input.purchaseRequestId,
        purchaseOrderId: order.id,
        goodsReceiptId: goodsReceipt?.id ?? null,
        grnNumber: goodsReceipt?.grnNumber ?? null,
        items: lines.map((line) => ({
          barangId: line.barangId,
          quantity: line.quantity,
        })),
        kelebihanKiriman: plan.overReceipts.map((item) => ({
          barang: item.barangName,
          tambahan: item.extraQuantity,
          alasan: item.reason,
        })),
        tidakDimasukkan: notEntered.map((line) => ({
          barangId: line.barangId,
          jumlah: line.quantity,
        })),
        jumlahFoto: input.fotoBukti.length,
        pesananDibuatOtomatis: context.isOrderCreated,
        pengajuanSelesai: closing.isWritten,
      },
    });
  }
}

/** Pengajuan belum tertutup; `cause` hanya untuk log server. */
function notClosed(message: string, cause?: unknown): EntryClosingAttempt {
  return {
    isWritten: false,
    failure: receiptFailure("CONFLICT", message, cause),
  };
}

/** Galat isian barang pengganti menjadi penolakan; galat lain dilempar ulang. */
async function runSubstitutionStep<T>(
  step: () => Promise<T>,
): Promise<StepResult<T>> {
  try {
    return { success: true, data: await step() };
  } catch (error: unknown) {
    if (error instanceof RestockSubstitutionInvalidError) {
      return receiptFailure("INVALID", error.message);
    }
    throw error;
  }
}

/** Barang yang benar-benar masuk; barang yang diganti dicatat dengan barang penggantinya. */
function toGoodsReceiptLines(
  plan: RestockEntryPlan,
  substitutions: RestockSubstitutionMap,
): RestockGoodsReceiptLine[] {
  return plan.lines
    .filter((line) => line.quantity > 0)
    .map(({ item, quantity }) => ({
      purchaseOrderItemId: item.id,
      barangId: substitutions[item.barangId] ?? item.barangId,
      quantity,
    }));
}

function describeGoodsReceiptNotes(context: EntryContext): string {
  const { overReceipts } = context.plan;
  return [
    `Penerimaan dari Pre Request ${context.snapshot.request.nomorRequest}`,
    ...(overReceipts.length > 0 ? [describeOverReceipts(overReceipts)] : []),
  ].join(". ");
}

/**
 * Pesan modul pembelian ditulis untuk programmer; penyebab aslinya ikut sebagai
 * `cause` untuk log. Pengajuan yang baru saja dibuatkan pesanan dari halaman
 * procurement (sudah diklaim, atau tidak lagi berstatus APPROVED) adalah
 * perubahan bersamaan, bukan gangguan server.
 */
function toPurchaseOrderCreationFailure(error: unknown): RestockReceiptFailure {
  if (error instanceof SupplierNotActiveError) {
    return receiptFailure(
      "CONFLICT",
      PURCHASE_ORDER_SUPPLIER_INACTIVE_MESSAGE,
      error,
    );
  }
  if (
    error instanceof PurchaseRequestAlreadyOrderedError ||
    error instanceof PurchaseRequestNotOrderableError
  ) {
    return receiptFailure("CONFLICT", RECEIPT_CONCURRENT_CHANGE_MESSAGE, error);
  }
  return receiptFailure("FAILED", PURCHASE_ORDER_NOT_GENERATED_MESSAGE, error);
}

/** Galat GRN yang dikenal menjadi penolakan untuk admin; null untuk gangguan tak terduga. */
function toGoodsReceiptFailure(error: unknown): RestockReceiptFailure | null {
  if (error instanceof PurchaseOrderNotFoundError) {
    return receiptFailure(
      "NOT_FOUND",
      RESTOCK_MESSAGES.purchaseOrderNotFound,
      error,
    );
  }
  if (error instanceof GoodsReceiptExceedsRemainingError) {
    return receiptFailure("CONFLICT", RECEIPT_CONCURRENT_CHANGE_MESSAGE, error);
  }
  if (error instanceof GoodsReceiptInvalidError) {
    return receiptFailure("INVALID", RECEIPT_MISMATCH_MESSAGE, error);
  }
  return null;
}
