import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import {
  ProcurementService,
  SupplierNotActiveError,
} from "@/modules/procurement";

import {
  RESTOCK_MESSAGES,
  restockAlreadyDecidedMessage,
  restockServerErrorMessage,
} from "./restock-messages";

/** Penjelasan untuk penyetuju bila PO tidak bisa dibuat otomatis setelah disetujui. */
const PO_SUPPLIER_INACTIVE_MESSAGE =
  "Pengajuan sudah disetujui, tapi pesanan pembelian (PO) belum bisa dibuat karena pemasok barangnya sedang tidak aktif. Minta bagian pembelian mengganti pemasoknya atau membuat PO sendiri.";
const PO_NOT_GENERATED_MESSAGE =
  "Pengajuan sudah disetujui, tapi pesanan pembelian (PO) belum bisa dibuat otomatis. Minta bagian pembelian membuat PO-nya.";

const LIFECYCLE_DECISION_WORDS = {
  APPROVE: "disetujui",
  REJECT: "ditolak",
} as const;

interface RestockRequestLifecycleInput {
  id: string;
  action: unknown;
  catatan: string | null | undefined;
  actorId: string;
  tenantId: string;
}

export class RestockRequestLifecycleService {
  constructor(
    private readonly procurementService: ProcurementService = new ProcurementService(),
  ) {}
  /** Ubah lifecycle approval purchase request restock. */
  async patchRestockRequestLifecycle(input: RestockRequestLifecycleInput) {
    const startTime = Date.now();
    try {
      const normalizedAction = this.parseLifecycleAction(input.action);
      if (!normalizedAction) {
        return NextResponse.json(
          { error: RESTOCK_MESSAGES.unknownLifecycleAction },
          { status: 400 },
        );
      }
      const existingRequest = await this.getPurchaseRequestForLifecycle(
        input.id,
        input.tenantId,
      );
      if (!existingRequest) {
        return NextResponse.json(
          { error: RESTOCK_MESSAGES.requestNotFound },
          { status: 404 },
        );
      }
      if (existingRequest.status !== "DRAFT") {
        return NextResponse.json(
          {
            error: restockAlreadyDecidedMessage(
              existingRequest.status,
              LIFECYCLE_DECISION_WORDS[normalizedAction],
            ),
          },
          { status: 400 },
        );
      }
      if (normalizedAction === "REJECT") {
        return this.rejectPurchaseRequest(existingRequest, input);
      }
      return this.approvePurchaseRequest(existingRequest, input, startTime);
    } catch (error: unknown) {
      logger.error(
        "Error updating purchase request",
        error instanceof Error ? error : new Error(String(error)),
        { path: "/api/inventory/restock/requests/[id]", method: "PATCH" },
      );
      // Persetujuan mengubah status lalu membuat PO dalam langkah terpisah,
      // jadi jangan menjanjikan bahwa tidak ada yang berubah.
      return NextResponse.json(
        { error: restockServerErrorMessage("Memproses pengajuan", false) },
        { status: 500 },
      );
    }
  }

  private parseLifecycleAction(
    action: unknown,
  ): keyof typeof LIFECYCLE_DECISION_WORDS | null {
    if (action === "APPROVE" || action === "REJECT") return action;
    return null;
  }

  private getPurchaseRequestForLifecycle(id: string, tenantId: string) {
    return prisma.purchaseRequest.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            barang: { select: { id: true, nama: true, supplierId: true } },
          },
        },
      },
    });
  }

  private async rejectPurchaseRequest(
    existingRequest: NonNullable<
      Awaited<
        ReturnType<
          RestockRequestLifecycleService["getPurchaseRequestForLifecycle"]
        >
      >
    >,
    input: RestockRequestLifecycleInput,
  ) {
    const updatedRequest = await prisma.purchaseRequest.update({
      where: { id: input.id },
      data: {
        status: "REJECTED",
        catatanApproval: input.catatan || null,
        approvedAt: new Date(),
        approvedBy: input.actorId,
      },
      include: {
        requester: { select: { name: true } },
        gudang: { select: { nama: true } },
      },
    });
    await logger.logActivity({
      userId: input.actorId,
      action: "REJECT PurchaseRequest",
      subject: existingRequest.nomorRequest,
      details: {
        id: input.id,
        previousStatus: existingRequest.status,
        newStatus: "REJECTED",
        catatan: input.catatan,
      },
    });
    return NextResponse.json(updatedRequest);
  }

  private async approvePurchaseRequest(
    existingRequest: NonNullable<
      Awaited<
        ReturnType<
          RestockRequestLifecycleService["getPurchaseRequestForLifecycle"]
        >
      >
    >,
    input: RestockRequestLifecycleInput,
    startTime: number,
  ) {
    await prisma.purchaseRequest.update({
      where: { id: input.id },
      data: {
        status: "APPROVED",
        catatanApproval: input.catatan || null,
        approvedAt: new Date(),
        approvedBy: input.actorId,
      },
    });
    const generatedPurchaseOrder = await this.safelyGeneratePurchaseOrder(
      input.id,
      input.actorId,
    );
    await this.logApprovalActivity(
      existingRequest,
      input,
      generatedPurchaseOrder,
    );
    this.logApprovalRequest(input, startTime, generatedPurchaseOrder);
    const updatedRequest = await this.findApprovedRequest(input.id);
    return NextResponse.json({
      ...updatedRequest,
      _autoGeneratedPO: generatedPurchaseOrder.generatedPO
        ? {
            id: generatedPurchaseOrder.generatedPO.id,
            poNumber: generatedPurchaseOrder.generatedPO.poNumber,
          }
        : null,
      _poError: generatedPurchaseOrder.poError,
    });
  }

  private async safelyGeneratePurchaseOrder(
    id: string,
    actorId: string,
  ): Promise<{
    generatedPO:
      | Awaited<ReturnType<ProcurementService["generatePOFromPRs"]>>[number]
      | null;
    poError: string | null;
  }> {
    try {
      const generatedPurchaseOrders =
        await this.procurementService.generatePOFromPRs([id], actorId);
      return {
        generatedPO: generatedPurchaseOrders?.[0] ?? null,
        poError: null,
      };
    } catch (error: unknown) {
      logger.warn("[RESTOCK_APPROVE] PO otomatis gagal dibuat", {
        purchaseRequestId: id,
        reason: error instanceof Error ? error.message : String(error),
      });
      return {
        generatedPO: null,
        poError:
          error instanceof SupplierNotActiveError
            ? PO_SUPPLIER_INACTIVE_MESSAGE
            : PO_NOT_GENERATED_MESSAGE,
      };
    }
  }

  private logApprovalActivity(
    existingRequest: NonNullable<
      Awaited<
        ReturnType<
          RestockRequestLifecycleService["getPurchaseRequestForLifecycle"]
        >
      >
    >,
    input: RestockRequestLifecycleInput,
    generatedPurchaseOrder: Awaited<
      ReturnType<RestockRequestLifecycleService["safelyGeneratePurchaseOrder"]>
    >,
  ) {
    return logger.logActivity({
      userId: input.actorId,
      action: "APPROVE PurchaseRequest",
      subject: existingRequest.nomorRequest,
      details: {
        id: input.id,
        previousStatus: existingRequest.status,
        newStatus: generatedPurchaseOrder.generatedPO ? "ORDERED" : "APPROVED",
        catatan: input.catatan,
        generatedPO: generatedPurchaseOrder.generatedPO?.poNumber || null,
        poError: generatedPurchaseOrder.poError,
      },
    });
  }

  private logApprovalRequest(
    input: RestockRequestLifecycleInput,
    startTime: number,
    generatedPurchaseOrder: Awaited<
      ReturnType<RestockRequestLifecycleService["safelyGeneratePurchaseOrder"]>
    >,
  ) {
    logger.apiRequest(
      "PATCH",
      `/api/inventory/restock/requests/${input.id}`,
      200,
      Date.now() - startTime,
      {
        userId: input.actorId,
        action: "APPROVE",
        generatedPO: generatedPurchaseOrder.generatedPO?.poNumber,
      },
    );
  }

  private findApprovedRequest(id: string) {
    return prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { name: true } },
        gudang: { select: { nama: true } },
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
      },
    });
  }
}
