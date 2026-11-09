import { generateLinkToken, hashLinkToken } from "@/lib/security/link-token";

import type {
  IRestockPurchaseLinkRepository,
  PurchaseLinkSummary,
} from "../domain/ports/IRestockPurchaseLinkRepository";
import type { IRestockPurchaseRecordRepository } from "../domain/ports/IRestockPurchaseRecordRepository";
import type { IRestockSignatureStorage } from "../domain/ports/IRestockSignatureStorage";
import {
  buildPurchaseLinkExpiry,
  describePurchaseLinkAvailability,
  PURCHASE_LINK_MESSAGES,
  type PurchaseLinkAvailability,
} from "../domain/restock-purchase-link";
import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "./inventory-activity-log";

export type PurchaseLinkErrorCode = "NOT_FOUND" | "UNAVAILABLE";

type LinkResult<T, E extends PurchaseLinkErrorCode> =
  | { success: true; data: T }
  | { success: false; code: E; error: string };

export interface PurchaseLinkStatus {
  /**
   * Link aktif (belum dicabut & belum kedaluwarsa) apa pun keadaan
   * pengajuannya, supaya admin selalu bisa melihat dan mematikannya. Null
   * bila tidak ada.
   */
  link: PurchaseLinkSummary | null;
  availability: PurchaseLinkAvailability;
}

interface RequestAvailability {
  requestNumber: string;
  availability: PurchaseLinkAvailability;
}

/**
 * Kelola link belanja tanpa login dari panel admin: lihat status, buat link
 * baru (yang lama otomatis mati), dan matikan link. Token mentah hanya
 * dikembalikan sekali saat dibuat dan tidak pernah disimpan atau dicatat.
 */
export class RestockPurchaseLinkService {
  constructor(
    private readonly links: IRestockPurchaseLinkRepository,
    private readonly records: Pick<
      IRestockPurchaseRecordRepository,
      "findPurchaseContext"
    >,
    private readonly storage: Pick<IRestockSignatureStorage, "isAvailable">,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Status link untuk panel admin. */
  async getStatus(
    purchaseRequestId: string,
    tenantId: string,
  ): Promise<LinkResult<PurchaseLinkStatus, "NOT_FOUND">> {
    const resolved = await this.resolveAvailability(
      purchaseRequestId,
      tenantId,
    );
    if (!resolved) return notFound();

    const link = await this.links.findActiveForRequest(
      purchaseRequestId,
      tenantId,
      this.now(),
    );
    return {
      success: true,
      data: { link, availability: resolved.availability },
    };
  }

  /** Buat link baru (yang lama dicabut). Token mentah dikembalikan sekali. */
  async create(
    purchaseRequestId: string,
    tenantId: string,
    actorId: string,
  ): Promise<
    LinkResult<
      { link: PurchaseLinkSummary; token: string },
      PurchaseLinkErrorCode
    >
  > {
    const resolved = await this.resolveAvailability(
      purchaseRequestId,
      tenantId,
    );
    if (!resolved) return notFound();
    if (resolved.availability !== "AVAILABLE") {
      return {
        success: false,
        code: "UNAVAILABLE",
        error: PURCHASE_LINK_MESSAGES.availability[resolved.availability],
      };
    }

    const now = this.now();
    const token = generateLinkToken();
    const link = await this.links.replaceActiveLink({
      purchaseRequestId,
      tenantId,
      tokenHash: hashLinkToken(token),
      expiresAt: buildPurchaseLinkExpiry(now),
      createdById: actorId,
      now,
    });

    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.CREATE_PURCHASE_LINK,
      subject: INVENTORY_ACTIVITY_SUBJECTS.RESTOCK_REQUEST,
      reference: resolved.requestNumber,
      actorId,
      tenantId,
      details: { linkId: link.id, berlakuSampai: link.expiresAt.toISOString() },
    });
    return { success: true, data: { link, token } };
  }

  /** Matikan link aktif pengajuan. */
  async revoke(
    purchaseRequestId: string,
    tenantId: string,
    actorId: string,
  ): Promise<LinkResult<{ revoked: boolean }, "NOT_FOUND">> {
    const context = await this.records.findPurchaseContext(
      purchaseRequestId,
      tenantId,
    );
    if (!context) return notFound();

    const now = this.now();
    const active = await this.links.findActiveForRequest(
      purchaseRequestId,
      tenantId,
      now,
    );
    const count = await this.links.revokeActiveLinks(
      purchaseRequestId,
      tenantId,
      actorId,
      now,
    );
    if (count > 0) {
      recordInventoryActivity({
        action: INVENTORY_ACTIVITY_ACTIONS.REVOKE_PURCHASE_LINK,
        subject: INVENTORY_ACTIVITY_SUBJECTS.RESTOCK_REQUEST,
        reference: context.request.nomorRequest,
        actorId,
        tenantId,
        details: {
          linkId: active?.id ?? null,
          berlakuSampai: active?.expiresAt.toISOString() ?? null,
        },
      });
    }
    return { success: true, data: { revoked: count > 0 } };
  }

  private async resolveAvailability(
    purchaseRequestId: string,
    tenantId: string,
  ): Promise<RequestAvailability | null> {
    const context = await this.records.findPurchaseContext(
      purchaseRequestId,
      tenantId,
    );
    if (!context) return null;
    const isStorageAvailable = await this.storage.isAvailable();
    return {
      requestNumber: context.request.nomorRequest,
      availability: describePurchaseLinkAvailability(
        context,
        isStorageAvailable,
      ),
    };
  }
}

function notFound(): { success: false; code: "NOT_FOUND"; error: string } {
  return {
    success: false,
    code: "NOT_FOUND",
    error: PURCHASE_LINK_MESSAGES.requestNotFound,
  };
}
