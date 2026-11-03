import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { ResellerCommissionRuleService } from "@/modules/reseller/services/ResellerCommissionRuleService";
import type { IResellerCommissionRuleRepository } from "@/modules/reseller/domain/ports/IResellerCommissionRuleRepository";
import type { ResellerCommissionRuleEntity } from "@/modules/reseller/domain/entities/ResellerCommissionEntity";
import {
  createResellerCommissionRuleSchema,
  updateResellerCommissionRuleSchema,
} from "@/modules/reseller/validators/reseller-commission-rule";

const NOW = new Date("2026-11-03T00:00:00.000Z");
/** 07:00 WIB 3 Nov → awal hari WIB 3 Nov = 2 Nov 17:00 UTC. */
const START_OF_TODAY_WIB = new Date("2026-11-02T17:00:00.000Z");

const RULE: ResellerCommissionRuleEntity = {
  id: "rule-1",
  tenantId: "tenant-1",
  resellerId: "reseller-1",
  hargaPaketId: null,
  type: "PERCENTAGE",
  rate: 10,
  fixedAmount: null,
  status: "ACTIVE",
  startsAt: new Date("2026-10-01T00:00:00.000Z"),
  endsAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

function createRepository(): IResellerCommissionRuleRepository {
  const repository = {
    listByReseller: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(RULE),
    findOverlappingActiveRule: vi.fn().mockResolvedValue(null),
    create: vi.fn(async (data) => ({ ...RULE, ...data, id: "rule-2" })),
    update: vi.fn(async (_id, data) => ({ ...RULE, ...data })),
    resellerExists: vi.fn().mockResolvedValue(true),
    packageExists: vi.fn().mockResolvedValue(true),
    runExclusive: vi.fn(),
  } as IResellerCommissionRuleRepository;
  vi.mocked(repository.runExclusive).mockImplementation(async (_scope, work) =>
    work(repository),
  );
  return repository;
}

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AppError) return error.statusCode;
    throw error;
  }
  throw new Error("Expected rejection");
}

describe("ResellerCommissionRuleService", () => {
  let repository: IResellerCommissionRuleRepository;
  let service: ResellerCommissionRuleService;

  beforeEach(() => {
    repository = createRepository();
    service = new ResellerCommissionRuleService(repository, () => NOW);
  });

  it("membuat aturan persen yang berlaku sejak awal hari ini (WIB)", async () => {
    await service.createRule("tenant-1", "reseller-1", {
      type: "PERCENTAGE",
      rate: 10,
      hargaPaketId: null,
    });

    expect(repository.create).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      hargaPaketId: null,
      type: "PERCENTAGE",
      rate: 10,
      fixedAmount: null,
      startsAt: START_OF_TODAY_WIB,
      endsAt: null,
    });
  });

  // Reviewer: cek bentrok lalu insert tanpa kunci membiarkan dua POST
  // bersamaan membuat dua aturan ACTIVE yang beririsan.
  it("memeriksa bentrok dan menyimpan di dalam kunci lingkup reseller+paket", async () => {
    const order: string[] = [];
    vi.mocked(repository.runExclusive).mockImplementationOnce(
      async (_scope, work) => {
        order.push("lock");
        const result = await work(repository);
        order.push("unlock");
        return result;
      },
    );
    vi.mocked(repository.findOverlappingActiveRule).mockImplementationOnce(
      async () => {
        order.push("check");
        return null;
      },
    );
    vi.mocked(repository.create).mockImplementationOnce(async (data) => {
      order.push("create");
      return { ...RULE, ...data };
    });

    await service.createRule("tenant-1", "reseller-1", {
      type: "PERCENTAGE",
      rate: 10,
      hargaPaketId: "package-1",
    });

    expect(repository.runExclusive).toHaveBeenCalledWith(
      {
        tenantId: "tenant-1",
        resellerId: "reseller-1",
        hargaPaketId: "package-1",
      },
      expect.any(Function),
    );
    expect(order).toEqual(["lock", "check", "create", "unlock"]);
  });

  it("membuat aturan nominal untuk satu paket milik tenant", async () => {
    await service.createRule("tenant-1", "reseller-1", {
      type: "FIXED",
      fixedAmount: 5000,
      hargaPaketId: "package-1",
    });

    expect(repository.packageExists).toHaveBeenCalledWith(
      "tenant-1",
      "package-1",
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "FIXED",
        rate: null,
        fixedAmount: 5000,
        hargaPaketId: "package-1",
      }),
    );
  });

  it("menolak paket tenant lain dengan 400", async () => {
    vi.mocked(repository.packageExists).mockResolvedValueOnce(false);

    expect(
      await statusOf(
        service.createRule("tenant-1", "reseller-1", {
          type: "FIXED",
          fixedAmount: 5000,
          hargaPaketId: "package-x",
        }),
      ),
    ).toBe(400);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("menolak reseller tenant lain dengan 404", async () => {
    vi.mocked(repository.resellerExists).mockResolvedValueOnce(false);

    expect(await statusOf(service.listRules("tenant-1", "reseller-x"))).toBe(
      404,
    );
  });

  it("menolak aturan aktif yang rentangnya beririsan dengan 409", async () => {
    vi.mocked(repository.findOverlappingActiveRule).mockResolvedValueOnce(RULE);

    expect(
      await statusOf(
        service.createRule("tenant-1", "reseller-1", {
          type: "PERCENTAGE",
          rate: 12,
          hargaPaketId: null,
        }),
      ),
    ).toBe(409);
    expect(repository.findOverlappingActiveRule).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      resellerId: "reseller-1",
      hargaPaketId: null,
      startsAt: START_OF_TODAY_WIB,
      endsAt: null,
    });
  });

  it("mengubah persen tanpa mengganti jenis", async () => {
    await service.updateRule("tenant-1", "reseller-1", "rule-1", { rate: 15 });

    expect(repository.update).toHaveBeenCalledWith("rule-1", {
      type: "PERCENTAGE",
      rate: 15,
      fixedAmount: null,
    });
  });

  it("menolak nominal untuk aturan persen dengan 400", async () => {
    expect(
      await statusOf(
        service.updateRule("tenant-1", "reseller-1", "rule-1", {
          fixedAmount: 5000,
        }),
      ),
    ).toBe(400);
  });

  it("mengganti jenis menjadi nominal dan mengosongkan persen", async () => {
    await service.updateRule("tenant-1", "reseller-1", "rule-1", {
      type: "FIXED",
      fixedAmount: 7000,
    });

    expect(repository.update).toHaveBeenCalledWith("rule-1", {
      type: "FIXED",
      rate: null,
      fixedAmount: 7000,
    });
  });

  it("memeriksa bentrok saat mengaktifkan ulang, tanpa menghitung dirinya", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce({
      ...RULE,
      status: "INACTIVE",
    });

    await service.updateRule("tenant-1", "reseller-1", "rule-1", {
      status: "ACTIVE",
    });

    expect(repository.findOverlappingActiveRule).toHaveBeenCalledWith(
      expect.objectContaining({ excludeRuleId: "rule-1" }),
    );
  });

  it("menolak tanggal akhir sebelum tanggal mulai tersimpan", async () => {
    expect(
      await statusOf(
        service.updateRule("tenant-1", "reseller-1", "rule-1", {
          endsAt: new Date("2026-09-01T00:00:00.000Z"),
        }),
      ),
    ).toBe(400);
  });

  it("menonaktifkan aturan secara idempoten", async () => {
    await service.deactivateRule("tenant-1", "reseller-1", "rule-1");
    expect(repository.update).toHaveBeenCalledWith("rule-1", {
      status: "INACTIVE",
    });

    vi.mocked(repository.update).mockClear();
    vi.mocked(repository.findById).mockResolvedValueOnce({
      ...RULE,
      status: "INACTIVE",
    });
    await service.deactivateRule("tenant-1", "reseller-1", "rule-1");
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("menjawab 404 untuk aturan yang tidak ada", async () => {
    vi.mocked(repository.findById).mockResolvedValueOnce(null);

    expect(
      await statusOf(service.deactivateRule("tenant-1", "reseller-1", "x")),
    ).toBe(404);
  });
});

describe("validator aturan komisi", () => {
  it.each([
    [{ type: "PERCENTAGE", rate: 0 }],
    [{ type: "PERCENTAGE", rate: 101 }],
    [{ type: "PERCENTAGE", rate: 2.555 }],
    [{ type: "PERCENTAGE", rate: 100.01 }],
    [{ type: "PERCENTAGE", rate: -1 }],
    [{ type: "PERCENTAGE", rate: Number.NaN }],
    [{ type: "PERCENTAGE" }],
    [{ type: "FIXED", fixedAmount: 0 }],
    [{ type: "FIXED", rate: 10 }],
    [{ type: "BONUS", rate: 10 }],
    [
      {
        type: "PERCENTAGE",
        rate: 10,
        startsAt: "2026-11-02",
        endsAt: "2026-11-01",
      },
    ],
  ])("menolak aturan baru %j", (input) => {
    expect(createResellerCommissionRuleSchema.safeParse(input).success).toBe(
      false,
    );
  });

  it("menerima persen 1–100 dan paket kosong menjadi null", () => {
    const parsed = createResellerCommissionRuleSchema.parse({
      type: "PERCENTAGE",
      rate: 100,
    });
    expect(parsed).toMatchObject({
      type: "PERCENTAGE",
      rate: 100,
      hargaPaketId: null,
    });
  });

  it.each([0.01, 0.5, 2.5, 2.55, 12.75, 99.99, 1])(
    "menerima persen hingga 2 desimal (%d)",
    (rate) => {
      expect(
        createResellerCommissionRuleSchema.parse({ type: "PERCENTAGE", rate }),
      ).toMatchObject({ rate });
    },
  );

  it("ubahan persen juga dibatasi 2 desimal", () => {
    expect(updateResellerCommissionRuleSchema.parse({ rate: 2.5 })).toEqual({
      rate: 2.5,
    });
    expect(
      updateResellerCommissionRuleSchema.safeParse({ rate: 2.505 }).success,
    ).toBe(false);
  });

  it("menolak ubahan yang berisi persen dan nominal sekaligus", () => {
    expect(
      updateResellerCommissionRuleSchema.safeParse({
        rate: 10,
        fixedAmount: 1000,
      }).success,
    ).toBe(false);
  });

  it("menolak ganti jenis tanpa nilai baru", () => {
    expect(
      updateResellerCommissionRuleSchema.safeParse({ type: "FIXED" }).success,
    ).toBe(false);
  });
});
