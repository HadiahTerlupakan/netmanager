import { describe, expect, it, vi } from "vitest";

import {
  NoCheckoutRepairService,
  type NoCheckoutRepairRecord,
} from "@/modules/attendance/services/NoCheckoutRepairService";

function createRecord(
  overrides: Partial<NoCheckoutRepairRecord> = {},
): NoCheckoutRepairRecord {
  return {
    id: "attendance-1",
    tenantId: "tenant-1",
    userId: "user-1",
    checkIn: new Date("2026-04-25T01:14:00.000Z"),
    checkOut: new Date("2026-04-25T13:00:00.000Z"),
    checkOutPhoto: "checkout-photo.jpg",
    checkOutLocation: "Office",
    status: "NO_CHECKOUT",
    notes: "(Auto-Checkout: Lupa Absen Pulang)",
    user: {
      workingHourMode: "FIXED",
      startWorkTime: "08:00",
      shift: null,
    },
    ...overrides,
  };
}

describe("NoCheckoutRepairService", () => {
  it("marks NO_CHECKOUT records with checkout evidence as repairable", () => {
    const service = new NoCheckoutRepairService();

    expect(service.isRepairable(createRecord())).toBe(true);
  });

  it("keeps pure auto-checkout records out of automatic repair", () => {
    const service = new NoCheckoutRepairService();

    const record = createRecord({
      checkOutPhoto: null,
      checkOutLocation: null,
      notes: "(Auto-Checkout: Lupa Absen Pulang)",
    });

    expect(service.isRepairable(record)).toBe(false);
  });

  it("repairs pure auto-checkout records when incident mode is explicit", async () => {
    const repository = {
      findCandidates: vi.fn().mockResolvedValue([
        createRecord({
          checkOutPhoto: null,
          checkOutLocation: null,
          notes: "(Auto-Checkout: Lupa Absen Pulang)",
        }),
      ]),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const statusCalculator = {
      calculateStatus: vi.fn().mockResolvedValue("ON_TIME"),
    };
    const evaluator = {
      recompute: vi.fn().mockResolvedValue(undefined),
    };
    const service = new NoCheckoutRepairService(
      repository,
      statusCalculator,
      evaluator,
    );

    const result = await service.repair({
      tenantId: "tenant-1",
      startDate: new Date("2026-04-25T00:00:00.000Z"),
      endDate: new Date("2026-04-25T23:59:59.999Z"),
      dryRun: false,
      actorId: "repair-script",
      timezone: "Asia/Jakarta",
      includeAutoCheckoutOnly: true,
    });

    expect(result).toEqual({ scanned: 1, repairable: 1, repaired: 1 });
    expect(repository.updateStatus).toHaveBeenCalledWith({
      attendanceId: "attendance-1",
      status: "ON_TIME",
    });
  });

  it("repairs evidence-backed records and recomputes their evaluation", async () => {
    const repository = {
      findCandidates: vi.fn().mockResolvedValue([createRecord()]),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const statusCalculator = {
      calculateStatus: vi.fn().mockResolvedValue("LATE"),
    };
    const evaluator = {
      recompute: vi.fn().mockResolvedValue(undefined),
    };
    const service = new NoCheckoutRepairService(
      repository,
      statusCalculator,
      evaluator,
    );

    const result = await service.repair({
      tenantId: "tenant-1",
      startDate: new Date("2026-04-25T00:00:00.000Z"),
      endDate: new Date("2026-04-25T23:59:59.999Z"),
      dryRun: false,
      actorId: "repair-script",
      timezone: "Asia/Jakarta",
    });

    expect(result).toEqual({ scanned: 1, repairable: 1, repaired: 1 });
    expect(repository.updateStatus).toHaveBeenCalledWith({
      attendanceId: "attendance-1",
      status: "LATE",
    });
    expect(evaluator.recompute).toHaveBeenCalledWith({
      userId: "user-1",
      tenantId: "tenant-1",
      startDate: new Date("2026-04-25T01:14:00.000Z"),
      endDate: new Date("2026-04-25T01:14:00.000Z"),
      actorId: "repair-script",
    });
  });

  it("does not mutate data in dry-run mode", async () => {
    const repository = {
      findCandidates: vi.fn().mockResolvedValue([createRecord()]),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };
    const service = new NoCheckoutRepairService(repository);

    const result = await service.repair({
      tenantId: "tenant-1",
      startDate: new Date("2026-04-25T00:00:00.000Z"),
      endDate: new Date("2026-04-25T23:59:59.999Z"),
      dryRun: true,
      actorId: "repair-script",
      timezone: "Asia/Jakarta",
    });

    expect(result).toEqual({ scanned: 1, repairable: 1, repaired: 0 });
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });
});
