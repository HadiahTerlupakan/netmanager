import {
  hashLinkToken,
  isValidLinkTokenFormat,
} from "@/lib/security/link-token";
import { decodePngSignatureDataUrl } from "@/lib/signature/png-signature";

import type {
  IRestockPurchaseLinkRepository,
  PublicPurchaseListSource,
} from "../domain/ports/IRestockPurchaseLinkRepository";
import type {
  IRestockPurchaseRecordRepository,
  RestockPurchaseContextItem,
} from "../domain/ports/IRestockPurchaseRecordRepository";
import type { IRestockSignatureStorage } from "../domain/ports/IRestockSignatureStorage";
import {
  evaluatePurchaseListState,
  getOwnedPurchaseItems,
  isPurchaseLinkUsable,
  isSameLinkSubmission,
  PURCHASE_LINK_MESSAGES,
} from "../domain/restock-purchase-link";
import {
  formatJakartaDate,
  getEffectivePurchased,
  getRemainingToBuy,
} from "../domain/restock-purchase-record";
import type { RestockPurchaseRecordService } from "./RestockPurchaseRecordService";

/** Batas tanda tangan pembeli dari link. */
export const MAX_BUYER_SIGNATURE_BYTES = 200 * 1024;
export const MAX_SIGNATURE_WIDTH = 4096;
export const MAX_SIGNATURE_HEIGHT = 1024;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_IP_ADDRESS_LENGTH = 64;

/** Link yang sudah lolos pemeriksaan dasar; tenant dijamin ada. */
export interface UsablePurchaseLink {
  id: string;
  purchaseRequestId: string;
  tenantId: string;
  createdById: string;
  expiresAt: Date;
  createdAt: Date;
}

/** Satu barang di daftar belanja publik. Sengaja tanpa harga & data internal. */
export interface PublicPurchaseListItem {
  purchaseOrderItemId: string;
  name: string;
  unit: string | null;
  needed: number;
  purchased: number;
  remaining: number;
  stores: Array<{ storeName: string; purchasedAt: string; quantity: number }>;
}

/** Daftar belanja seperti dilihat pemegang link. */
export interface PublicPurchaseListView {
  state: "ACTIVE" | "ALL_PURCHASED";
  requestNumber: string;
  warehouseName: string;
  validUntil: string;
  items: PublicPurchaseListItem[];
}

/** Isian catatan belanja dari link (sudah lolos validasi bentuk). */
export interface PublicPurchaseSubmitInput {
  clientRequestId: string;
  buyerName: string;
  storeName: string;
  purchasedAt: string;
  notes: string | null;
  signatureDataUrl: string;
  items: Array<{
    purchaseOrderItemId: string;
    quantity: number;
    unitPrice: number | null;
  }>;
}

export interface PublicPurchaseClient {
  ipAddress: string | null;
  userAgent: string | null;
}

export type PublicPurchaseErrorCode =
  | "LINK_INACTIVE"
  | "INVALID"
  | "CONFLICT"
  | "STORAGE_UNAVAILABLE";

type PublicResult<T, E extends PublicPurchaseErrorCode> =
  | { success: true; data: T }
  | { success: false; code: E; error: string };

export interface PublicPurchaseSubmitOutcome {
  state: "ACTIVE" | "ALL_PURCHASED";
  message: string;
  isReplay: boolean;
}

function fail<E extends PublicPurchaseErrorCode>(
  code: E,
  error: string,
): { success: false; code: E; error: string } {
  return { success: false, code, error };
}

const inactive = () =>
  fail("LINK_INACTIVE" as const, PURCHASE_LINK_MESSAGES.inactive);

function truncate(value: string | null, max: number): string | null {
  return value ? value.slice(0, max) : null;
}

function describeOutcome(
  state: "ACTIVE" | "ALL_PURCHASED",
  isReplay: boolean,
): PublicPurchaseSubmitOutcome {
  return {
    state,
    message:
      state === "ALL_PURCHASED"
        ? PURCHASE_LINK_MESSAGES.allPurchased
        : PURCHASE_LINK_MESSAGES.savedPartial,
    isReplay,
  };
}

function signatureError(reason: string): string {
  return reason === "TOO_LARGE"
    ? PURCHASE_LINK_MESSAGES.signatureTooLarge
    : PURCHASE_LINK_MESSAGES.invalidSignature;
}

/**
 * Daftar belanja dan pencatatan belanja lewat link tanpa login.
 *
 * `resolveLink` adalah satu-satunya langkah yang boleh dijalankan di system
 * context (mencari link lewat sidik jari token). `getList` dan `submit`
 * dipanggil di konteks tenant milik link, dan setiap query-nya juga memakai
 * tenant link secara eksplisit.
 */
export class RestockPublicPurchaseService {
  constructor(
    private readonly links: IRestockPurchaseLinkRepository,
    private readonly records: Pick<
      IRestockPurchaseRecordRepository,
      "findPurchaseContext" | "findByClientRequestId"
    >,
    private readonly recorder: Pick<
      RestockPurchaseRecordService,
      "recordPurchase"
    >,
    private readonly storage: IRestockSignatureStorage,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Cari link yang masih bisa dipakai; null untuk semua alasan gagal. */
  async resolveLink(token: string): Promise<UsablePurchaseLink | null> {
    if (!isValidLinkTokenFormat(token)) return null;
    const link = await this.links.findByTokenHash(hashLinkToken(token));
    if (!link || !isPurchaseLinkUsable(link, this.now()) || !link.tenantId) {
      return null;
    }
    return {
      id: link.id,
      purchaseRequestId: link.purchaseRequestId,
      tenantId: link.tenantId,
      createdById: link.createdById,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
    };
  }

  /** Daftar barang yang perlu dibeli untuk pengajuan link ini. */
  async getList(
    link: UsablePurchaseLink,
  ): Promise<PublicResult<PublicPurchaseListView, "LINK_INACTIVE">> {
    const source = await this.links.findPublicListSource(
      link.purchaseRequestId,
      link.tenantId,
    );
    if (!source) return inactive();
    const state = evaluatePurchaseListState(source.context);
    if (state === "INACTIVE") return inactive();

    await this.links.touchLastUsed(link.id, link.tenantId, this.now());
    return {
      success: true,
      data: {
        state,
        requestNumber: source.context.request.nomorRequest,
        warehouseName: source.warehouseName,
        validUntil: link.expiresAt.toISOString(),
        items: buildListItems(source),
      },
    };
  }

  /** Catat satu belanja di satu toko lewat link, dengan tanda tangan pembeli. */
  async submit(
    link: UsablePurchaseLink,
    input: PublicPurchaseSubmitInput,
    client: PublicPurchaseClient,
  ): Promise<
    PublicResult<PublicPurchaseSubmitOutcome, PublicPurchaseErrorCode>
  > {
    const context = await this.records.findPurchaseContext(
      link.purchaseRequestId,
      link.tenantId,
    );
    if (!context) return inactive();
    const state = evaluatePurchaseListState(context);
    if (state === "INACTIVE") return inactive();

    // Kiriman ulang dikenali sebelum apa pun ditulis atau diunggah.
    const existing = await this.records.findByClientRequestId(
      link.id,
      input.clientRequestId,
      link.tenantId,
    );
    if (existing) {
      return isSameLinkSubmission(existing, input)
        ? { success: true, data: describeOutcome(state, true) }
        : fail("CONFLICT", PURCHASE_LINK_MESSAGES.replayMismatch);
    }
    if (state === "ALL_PURCHASED") {
      return fail("CONFLICT", PURCHASE_LINK_MESSAGES.allPurchased);
    }

    const signature = decodePngSignatureDataUrl(input.signatureDataUrl, {
      maxBytes: MAX_BUYER_SIGNATURE_BYTES,
      maxWidth: MAX_SIGNATURE_WIDTH,
      maxHeight: MAX_SIGNATURE_HEIGHT,
    });
    if (signature.ok === false) {
      return fail("INVALID", signatureError(signature.reason));
    }

    if (!(await this.storage.isAvailable())) {
      return fail(
        "STORAGE_UNAVAILABLE",
        PURCHASE_LINK_MESSAGES.storageUnavailable,
      );
    }
    const signatureKey = await this.storage.save({
      tenantId: link.tenantId,
      purchaseRequestId: link.purchaseRequestId,
      buffer: signature.buffer,
    });

    return this.recordWithSignature(link, input, client, signatureKey);
  }

  private async recordWithSignature(
    link: UsablePurchaseLink,
    input: PublicPurchaseSubmitInput,
    client: PublicPurchaseClient,
    signatureKey: string,
  ): Promise<
    PublicResult<PublicPurchaseSubmitOutcome, PublicPurchaseErrorCode>
  > {
    let result: Awaited<
      ReturnType<RestockPurchaseRecordService["recordPurchase"]>
    >;
    try {
      result = await this.recorder.recordPurchase({
        purchaseRequestId: link.purchaseRequestId,
        tenantId: link.tenantId,
        origin: {
          kind: "PUBLIC_LINK",
          linkId: link.id,
          linkCreatorId: link.createdById,
          linkCreatedAt: link.createdAt,
          buyerName: input.buyerName,
          signatureKey,
          clientRequestId: input.clientRequestId,
          ipAddress: truncate(client.ipAddress, MAX_IP_ADDRESS_LENGTH),
          userAgent: truncate(client.userAgent, MAX_USER_AGENT_LENGTH),
        },
        storeName: input.storeName,
        supplierId: null,
        purchasedAt: input.purchasedAt,
        notes: input.notes,
        fotoNota: [],
        items: input.items,
      });
    } catch (error) {
      await this.storage.remove(signatureKey);
      throw error;
    }

    if (result.success === false) {
      await this.storage.remove(signatureKey);
      if (result.code === "INVALID") return fail("INVALID", result.error);
      if (result.code === "CONFLICT") {
        return fail("CONFLICT", PURCHASE_LINK_MESSAGES.conflict);
      }
      if (result.code === "LIMIT_REACHED") {
        return fail("CONFLICT", result.error);
      }
      return inactive();
    }
    if (result.data.isReplay) {
      await this.storage.remove(signatureKey);
      if (!isSameLinkSubmission(result.data.record, input)) {
        return fail("CONFLICT", PURCHASE_LINK_MESSAGES.replayMismatch);
      }
    }

    await this.links.touchLastUsed(link.id, link.tenantId, this.now());
    return {
      success: true,
      data: describeOutcome(
        result.data.isFullyPurchased ? "ALL_PURCHASED" : "ACTIVE",
        result.data.isReplay,
      ),
    };
  }
}

function buildListItems(
  source: PublicPurchaseListSource,
): PublicPurchaseListItem[] {
  const owned = getOwnedPurchaseItems(source.context);
  return owned
    .map((item) => toListItem(item, source.records))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

function toListItem(
  item: RestockPurchaseContextItem,
  records: PublicPurchaseListSource["records"],
): PublicPurchaseListItem {
  return {
    purchaseOrderItemId: item.id,
    name: item.barang?.nama ?? "Barang",
    unit: item.barang?.satuan ?? null,
    needed: Math.max(item.quantity - item.cancelledQuantity, 0),
    purchased: getEffectivePurchased(item),
    remaining: getRemainingToBuy(item),
    stores: records.flatMap((record) =>
      record.items
        .filter((line) => line.purchaseOrderItemId === item.id)
        .map((line) => ({
          storeName: record.storeName,
          purchasedAt: formatJakartaDate(record.purchasedAt),
          quantity: line.quantity,
        })),
    ),
  };
}
