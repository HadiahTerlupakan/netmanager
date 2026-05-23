import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { FeatureFlagService } from "@/modules/feature-flags";
import type {
  IFeatureFlagRepository,
  TenantFeatureFlagRow,
} from "@/modules/feature-flags";
import { cache } from "@/lib/cache";
import { FEATURE_MODULES } from "@/lib/feature-modules";

const TENANT_A = "tenant-aaa";
const TENANT_B = "tenant-bbb";

function buildRow(
  overrides: Partial<TenantFeatureFlagRow> & { feature: string },
): TenantFeatureFlagRow {
  return {
    feature: overrides.feature,
    enabled: overrides.enabled ?? true,
    updatedBy: overrides.updatedBy ?? null,
    updatedAt: overrides.updatedAt ?? new Date("2026-05-23T00:00:00Z"),
  };
}

interface MockedRepo {
  repo: IFeatureFlagRepository;
  findAllByTenant: Mock;
  findByFeature: Mock;
  upsert: Mock;
}

function createMockRepo(): MockedRepo {
  const findAllByTenant = vi.fn();
  const findByFeature = vi.fn();
  const upsert = vi.fn();
  const repo = {
    findAllByTenant,
    findByFeature,
    upsert,
  } as unknown as IFeatureFlagRepository;
  return { repo, findAllByTenant, findByFeature, upsert };
}

describe("FeatureFlagService", () => {
  beforeEach(() => {
    cache.clear();
  });

  afterEach(() => {
    cache.clear();
    vi.clearAllMocks();
  });

  describe("isEnabled", () => {
    it("returns true ketika tidak ada row di DB (default open)", async () => {
      const { repo, findAllByTenant } = createMockRepo();
      findAllByTenant.mockResolvedValue([]);
      const service = new FeatureFlagService(repo);

      await expect(service.isEnabled(TENANT_A, "accounting")).resolves.toBe(
        true,
      );
      expect(findAllByTenant).toHaveBeenCalledOnce();
      expect(findAllByTenant).toHaveBeenCalledWith(TENANT_A);
    });

    it("returns false ketika row enabled=false", async () => {
      const { repo, findAllByTenant } = createMockRepo();
      findAllByTenant.mockResolvedValue([
        buildRow({ feature: "accounting", enabled: false }),
      ]);
      const service = new FeatureFlagService(repo);

      await expect(service.isEnabled(TENANT_A, "accounting")).resolves.toBe(
        false,
      );
    });

    it("returns true ketika row enabled=true (eksplisit)", async () => {
      const { repo, findAllByTenant } = createMockRepo();
      findAllByTenant.mockResolvedValue([
        buildRow({ feature: "accounting", enabled: true }),
      ]);
      const service = new FeatureFlagService(repo);

      await expect(service.isEnabled(TENANT_A, "accounting")).resolves.toBe(
        true,
      );
    });

    it("modul lain tetap enabled meski satu modul disabled", async () => {
      const { repo, findAllByTenant } = createMockRepo();
      findAllByTenant.mockResolvedValue([
        buildRow({ feature: "accounting", enabled: false }),
      ]);
      const service = new FeatureFlagService(repo);

      await expect(service.isEnabled(TENANT_A, "marketing")).resolves.toBe(
        true,
      );
    });

    it("ignore feature code yang tidak dikenali di catalog", async () => {
      const { repo, findAllByTenant } = createMockRepo();
      findAllByTenant.mockResolvedValue([
        buildRow({ feature: "unknown-feature", enabled: false }),
      ]);
      const service = new FeatureFlagService(repo);

      await expect(service.isEnabled(TENANT_A, "accounting")).resolves.toBe(
        true,
      );
    });
  });

  describe("caching", () => {
    it("cache hit pada panggilan kedua dalam TTL", async () => {
      const { repo, findAllByTenant } = createMockRepo();
      findAllByTenant.mockResolvedValue([
        buildRow({ feature: "accounting", enabled: false }),
      ]);
      const service = new FeatureFlagService(repo);

      await service.isEnabled(TENANT_A, "accounting");
      await service.isEnabled(TENANT_A, "marketing");

      expect(findAllByTenant).toHaveBeenCalledOnce();
    });

    it("setFeature meng-invalidate cache untuk tenant terkait", async () => {
      const { repo, findAllByTenant, upsert } = createMockRepo();
      findAllByTenant
        .mockResolvedValueOnce([
          buildRow({ feature: "accounting", enabled: true }),
        ])
        .mockResolvedValueOnce([
          buildRow({ feature: "accounting", enabled: false }),
        ]);
      upsert.mockResolvedValue(
        buildRow({ feature: "accounting", enabled: false }),
      );

      const service = new FeatureFlagService(repo);

      await expect(service.isEnabled(TENANT_A, "accounting")).resolves.toBe(
        true,
      );

      await service.setFeature(TENANT_A, "accounting", false, "user-1");

      await expect(service.isEnabled(TENANT_A, "accounting")).resolves.toBe(
        false,
      );
      expect(findAllByTenant).toHaveBeenCalledTimes(2);
    });

    it("cache per-tenant terisolasi", async () => {
      const { repo, findAllByTenant } = createMockRepo();
      findAllByTenant.mockImplementation(async (tenantId: string) => {
        if (tenantId === TENANT_A) {
          return [buildRow({ feature: "accounting", enabled: false })];
        }
        return [];
      });
      const service = new FeatureFlagService(repo);

      await expect(service.isEnabled(TENANT_A, "accounting")).resolves.toBe(
        false,
      );
      await expect(service.isEnabled(TENANT_B, "accounting")).resolves.toBe(
        true,
      );
    });

    it("invalidate hanya menyentuh tenant yang di-update", async () => {
      const { repo, findAllByTenant, upsert } = createMockRepo();
      const tenantAState: TenantFeatureFlagRow[] = [
        buildRow({ feature: "accounting", enabled: false }),
      ];
      findAllByTenant.mockImplementation(async (tenantId: string) => {
        if (tenantId === TENANT_A) return tenantAState;
        return [];
      });
      upsert.mockImplementation(
        async (
          _tenantId: string,
          feature: string,
          enabled: boolean,
          updatedBy: string | null,
        ) => buildRow({ feature, enabled, updatedBy }),
      );

      const service = new FeatureFlagService(repo);

      // Warm cache untuk B
      await service.isEnabled(TENANT_B, "accounting");

      // Update untuk A — cache B harus tetap warm
      await service.setFeature(TENANT_A, "marketing", false, null);

      await service.isEnabled(TENANT_B, "accounting");

      // setFeature hanya call upsert lalu invalidate cache TENANT_A;
      // isEnabled subsequent untuk B harus cache hit (1 call).
      const callsForB = findAllByTenant.mock.calls.filter(
        (c: unknown[]) => c[0] === TENANT_B,
      ).length;
      expect(callsForB).toBe(1);
    });
  });

  describe("getDisabledFeatures", () => {
    it("hanya mengembalikan feature dengan enabled=false", async () => {
      const { repo, findAllByTenant } = createMockRepo();
      findAllByTenant.mockResolvedValue([
        buildRow({ feature: "accounting", enabled: false }),
        buildRow({ feature: "marketing", enabled: true }),
        buildRow({ feature: "tax", enabled: false }),
      ]);
      const service = new FeatureFlagService(repo);

      const disabled = await service.getDisabledFeatures(TENANT_A);
      expect([...disabled].sort()).toEqual(["accounting", "tax"].sort());
    });
  });

  describe("getCatalogForTenant", () => {
    it("merge catalog statis + state per tenant; default enabled untuk yang tidak ada row", async () => {
      const { repo, findAllByTenant } = createMockRepo();
      findAllByTenant.mockResolvedValue([
        buildRow({
          feature: "accounting",
          enabled: false,
          updatedBy: "admin-1",
        }),
      ]);
      const service = new FeatureFlagService(repo);

      const catalog = await service.getCatalogForTenant(TENANT_A);

      expect(catalog).toHaveLength(FEATURE_MODULES.length);

      const accountingItem = catalog.find((c) => c.feature === "accounting");
      expect(accountingItem).toMatchObject({
        feature: "accounting",
        enabled: false,
        updatedBy: "admin-1",
      });
      expect(accountingItem?.updatedAt).toBeTruthy();

      const marketingItem = catalog.find((c) => c.feature === "marketing");
      expect(marketingItem).toMatchObject({
        feature: "marketing",
        enabled: true,
        updatedBy: null,
        updatedAt: null,
      });
    });
  });

  describe("setBatch", () => {
    it("upsert tiap update lalu invalidate cache sekali", async () => {
      const { repo, findAllByTenant, upsert } = createMockRepo();
      findAllByTenant.mockResolvedValue([]);
      upsert.mockImplementation(
        async (
          _tenantId: string,
          feature: string,
          enabled: boolean,
          updatedBy: string | null,
        ) => buildRow({ feature, enabled, updatedBy }),
      );
      const service = new FeatureFlagService(repo);

      // Warm cache
      await service.isEnabled(TENANT_A, "accounting");

      const result = await service.setBatch(
        TENANT_A,
        [
          { feature: "accounting", enabled: false },
          { feature: "tax", enabled: false },
        ],
        "admin-1",
      );

      expect(upsert).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);

      // Second isEnabled call harus refetch (cache di-invalidate)
      findAllByTenant.mockResolvedValue([
        buildRow({ feature: "accounting", enabled: false }),
        buildRow({ feature: "tax", enabled: false }),
      ]);
      await expect(service.isEnabled(TENANT_A, "tax")).resolves.toBe(false);
      expect(findAllByTenant).toHaveBeenCalledTimes(2);
    });
  });
});
