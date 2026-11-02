import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureWarrantyClaimAllowed: vi.fn(),
  assign: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/modules/database", () => ({ prisma: {}, prismaMitra: {} }));
vi.mock("@/modules/notification", () => ({
  notifyAdminsAboutMobileAction: vi.fn(),
}));
vi.mock(
  "@/modules/work-order/services/MobileAvailableWorkOrderService",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    getMobileAvailableWorkOrderService: () => ({
      ensureWarrantyClaimAllowed: mocks.ensureWarrantyClaimAllowed,
    }),
  }),
);

import { WorkOrderValidationError } from "@/modules/work-order/domain/errors";
import { MobileAvailableWorkOrderService } from "@/modules/work-order/services/MobileAvailableWorkOrderService";
import { MobileWorkOrderActionService } from "@/modules/work-order/services/MobileWorkOrderActionService";
import {
  buildEmployeeWhereClause,
  buildWarrantyClaimableWhere,
} from "@/modules/work-order/services/mobile-available-work-order.helpers";

/**
 * Aturan siapa yang boleh mengambil WO garansi dulu hanya dipakai menyaring
 * daftar WO tersedia. Teknisi yang tahu ID WO garansi milik orang lain tetap
 * bisa mengklaimnya lewat kedua endpoint klaim. Kini aturan yang SAMA
 * (`buildWarrantyClaimableWhere`) dicek ulang saat klaim.
 */

const ACTOR = "tech-2";

describe("aturan garansi satu sumber untuk daftar dan klaim", () => {
  it("daftar WO tersedia memakai aturan garansi yang sama", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    vi.useFakeTimers({ now });
    try {
      const where = buildEmployeeWhereClause("tenant-1", ACTOR, null, []);
      expect(where.OR).toEqual(buildWarrantyClaimableWhere(ACTOR, now).OR);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ensureWarrantyClaimAllowed menolak WO garansi milik teknisi lain", async () => {
    const repository = {
      isWorkOrderMatchingFilter: vi.fn().mockResolvedValue(false),
    };
    const service = new MobileAvailableWorkOrderService(repository as never);

    await expect(
      service.ensureWarrantyClaimAllowed("wo-1", "tenant-1", ACTOR),
    ).rejects.toBeInstanceOf(WorkOrderValidationError);

    const [workOrderId, tenantId, where] =
      repository.isWorkOrderMatchingFilter.mock.calls[0];
    expect([workOrderId, tenantId]).toEqual(["wo-1", "tenant-1"]);
    expect(JSON.stringify(where)).toContain(`"warrantyOwnerId":"${ACTOR}"`);
  });

  it("ensureWarrantyClaimAllowed meloloskan WO yang memenuhi aturan", async () => {
    const service = new MobileAvailableWorkOrderService({
      isWorkOrderMatchingFilter: vi.fn().mockResolvedValue(true),
    } as never);

    await expect(
      service.ensureWarrantyClaimAllowed("wo-1", "tenant-1", ACTOR),
    ).resolves.toBeUndefined();
  });
});

describe("aksi CLAIM mobile (/work-orders/:id/update) menegakkan aturan garansi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function claim(workOrder: Record<string, unknown>) {
    const service = new MobileWorkOrderActionService({
      assign: mocks.assign,
    } as never);
    const claimWorkOrder = (
      service as unknown as {
        claimWorkOrder: (input: unknown) => Promise<void>;
      }
    ).claimWorkOrder.bind(service);
    return claimWorkOrder({
      input: {
        workOrderId: "wo-1",
        tenantId: "tenant-1",
        actor: { id: ACTOR },
        payload: { action: "CLAIM" },
      },
      workOrder: { status: "PENDING", assignedToId: null, ...workOrder },
      actionContext: {},
    });
  }

  it("menolak WO garansi milik teknisi lain tanpa meng-assign", async () => {
    mocks.ensureWarrantyClaimAllowed.mockRejectedValue(
      new Error("Anda tidak memiliki akses ke Work Order ini (garansi)"),
    );

    await expect(claim({})).rejects.toThrow("tidak memiliki akses");
    expect(mocks.ensureWarrantyClaimAllowed).toHaveBeenCalledWith(
      "wo-1",
      "tenant-1",
      ACTOR,
    );
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it("meng-assign bila aturan garansi lolos", async () => {
    mocks.ensureWarrantyClaimAllowed.mockResolvedValue(undefined);

    await claim({});

    expect(mocks.assign).toHaveBeenCalledWith("wo-1", ACTOR, "Lead", ACTOR);
  });
});
