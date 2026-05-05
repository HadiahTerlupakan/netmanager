import { describe, it, expect, beforeEach, vi } from "vitest";
import { RadiusAdminService } from "@/modules/network/services/RadiusAdminService";
import type { IRadiusRepository } from "@/modules/network/domain/ports/IRadiusRepository";

// Mock logger
vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
}));

describe("RadiusAdminService", () => {
  let radiusAdminService: RadiusAdminService;
  let mockRadiusRepository: IRadiusRepository;

  const mockSession = {
    radAcctId: "1",
    acctsessionid: "session-1",
    username: "user@test.com",
    nasipaddress: "192.168.1.1",
    acctstarttime: new Date("2026-05-05T08:00:00Z"),
    framedipaddress: "10.0.0.1",
  };

  const mockNas = {
    id: 1,
    nasname: "192.168.1.1",
    shortname: "Router1",
    type: "mikrotik",
    secret: "secret123",
    ports: 1812,
    community: "public",
    description: "Main Router",
  };

  const mockIpPool = {
    id: 1,
    poolName: "pool1",
    framedIpAddress: "10.0.0.1",
  };

  beforeEach(() => {
    mockRadiusRepository = {
      getActiveSessions: vi.fn(),
      getAllNas: vi.fn(),
      getNasById: vi.fn(),
      getNasByIp: vi.fn(),
      createNas: vi.fn(),
      updateNas: vi.fn(),
      deleteNas: vi.fn(),
      getAllIpPools: vi.fn(),
      getIpPoolStats: vi.fn(),
      addToIpPool: vi.fn(),
      removeFromIpPool: vi.fn(),
    } as unknown as IRadiusRepository;

    radiusAdminService = new RadiusAdminService(mockRadiusRepository);
  });

  describe("getActiveSessions", () => {
    it("harus return active sessions untuk tenant", async () => {
      const query = {
        tenantId: "tenant-1",
      };

      vi.mocked(mockRadiusRepository.getActiveSessions).mockResolvedValue([
        mockSession,
      ] as never);

      const result = await radiusAdminService.getActiveSessions(query);

      expect(result.count).toBe(1);
      expect(result.sessions).toHaveLength(1);
      expect(mockRadiusRepository.getActiveSessions).toHaveBeenCalledWith(
        "tenant-1",
        undefined,
      );
    });

    it("harus filter by username", async () => {
      const query = {
        tenantId: "tenant-1",
        username: "user@test.com",
      };

      vi.mocked(mockRadiusRepository.getActiveSessions).mockResolvedValue([
        mockSession,
      ] as never);

      const result = await radiusAdminService.getActiveSessions(query);

      expect(result.count).toBe(1);
      expect(mockRadiusRepository.getActiveSessions).toHaveBeenCalledWith(
        "tenant-1",
        "user@test.com",
      );
    });
  });

  describe("getNasList", () => {
    it("harus return list of NAS entries", async () => {
      vi.mocked(mockRadiusRepository.getAllNas).mockResolvedValue([
        mockNas,
      ] as never);

      const result = await radiusAdminService.getNasList("tenant-1");

      expect(result.count).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(mockRadiusRepository.getAllNas).toHaveBeenCalledWith("tenant-1");
    });
  });

  describe("getNasById", () => {
    it("harus return NAS by id", async () => {
      vi.mocked(mockRadiusRepository.getNasById).mockResolvedValue(
        mockNas as never,
      );

      const result = await radiusAdminService.getNasById(1, "tenant-1");

      expect(result).toEqual(mockNas);
      expect(mockRadiusRepository.getNasById).toHaveBeenCalledWith(
        1,
        "tenant-1",
      );
    });

    it("harus throw error jika NAS tidak ditemukan", async () => {
      vi.mocked(mockRadiusRepository.getNasById).mockResolvedValue(
        null as never,
      );

      await expect(
        radiusAdminService.getNasById(999, "tenant-1"),
      ).rejects.toThrow();
    });
  });

  describe("createNas", () => {
    it("harus create NAS entry", async () => {
      const input = {
        tenantId: "tenant-1",
        userId: "user-1",
        payload: {
          nasname: "192.168.1.1",
          shortname: "Router1",
          type: "mikrotik",
          secret: "secret123",
          ports: 1812,
        },
      };

      vi.mocked(mockRadiusRepository.getNasByIp).mockResolvedValue(
        null as never,
      );
      vi.mocked(mockRadiusRepository.createNas).mockResolvedValue(
        mockNas as never,
      );

      const result = await radiusAdminService.createNas(input);

      expect(result).toEqual(mockNas);
      expect(mockRadiusRepository.createNas).toHaveBeenCalled();
    });
  });

  describe("updateNas", () => {
    it("harus update NAS entry", async () => {
      const input = {
        id: 1,
        tenantId: "tenant-1",
        payload: {
          shortname: "UpdatedRouter",
        },
      };

      const updatedNas = { ...mockNas, shortname: "UpdatedRouter" };

      vi.mocked(mockRadiusRepository.getNasById).mockResolvedValue(
        mockNas as never,
      );
      vi.mocked(mockRadiusRepository.updateNas).mockResolvedValue(
        updatedNas as never,
      );

      const result = await radiusAdminService.updateNas(input);

      expect(result.shortname).toBe("UpdatedRouter");
      expect(mockRadiusRepository.updateNas).toHaveBeenCalled();
    });

    it("harus throw error jika NAS tidak ditemukan", async () => {
      const input = {
        id: 999,
        tenantId: "tenant-1",
        payload: {
          shortname: "UpdatedRouter",
        },
      };

      vi.mocked(mockRadiusRepository.getNasById).mockResolvedValue(
        null as never,
      );

      await expect(radiusAdminService.updateNas(input)).rejects.toThrow();
    });
  });

  describe("deleteNas", () => {
    it("harus delete NAS entry", async () => {
      vi.mocked(mockRadiusRepository.getNasById).mockResolvedValue(
        mockNas as never,
      );
      vi.mocked(mockRadiusRepository.deleteNas).mockResolvedValue(undefined);

      await radiusAdminService.deleteNas(1, "tenant-1");

      expect(mockRadiusRepository.deleteNas).toHaveBeenCalledWith(
        1,
        "tenant-1",
      );
    });

    it("harus throw error jika NAS tidak ditemukan", async () => {
      vi.mocked(mockRadiusRepository.getNasById).mockResolvedValue(
        null as never,
      );

      await expect(
        radiusAdminService.deleteNas(999, "tenant-1"),
      ).rejects.toThrow();
    });
  });

  describe("getIpPools", () => {
    it("harus return IP pool list", async () => {
      const query = {
        tenantId: "tenant-1",
        getStats: false,
      };

      vi.mocked(mockRadiusRepository.getAllIpPools).mockResolvedValue([
        mockIpPool,
      ] as never);

      const result = await radiusAdminService.getIpPools(query);

      expect(result.count).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(mockRadiusRepository.getAllIpPools).toHaveBeenCalledWith(
        "tenant-1",
      );
    });

    it("harus return IP pool stats", async () => {
      const query = {
        tenantId: "tenant-1",
        getStats: true,
      };

      const mockStats = {
        total: 100,
        used: 50,
        available: 50,
      };

      vi.mocked(mockRadiusRepository.getIpPoolStats).mockResolvedValue(
        mockStats as never,
      );

      const result = await radiusAdminService.getIpPools(query);

      expect(result.data).toEqual(mockStats);
      expect(mockRadiusRepository.getIpPoolStats).toHaveBeenCalledWith(
        "tenant-1",
        undefined,
      );
    });

    it("harus filter by poolName", async () => {
      const query = {
        tenantId: "tenant-1",
        poolName: "pool1",
        getStats: false,
      };

      vi.mocked(mockRadiusRepository.getAllIpPools).mockResolvedValue([
        mockIpPool,
      ] as never);

      const result = await radiusAdminService.getIpPools(query);

      expect(result.poolName).toBe("pool1");
      expect(result.data).toHaveLength(1);
    });
  });

  describe("addIpPool", () => {
    it("harus add IP to pool", async () => {
      const input = {
        tenantId: "tenant-1",
        userId: "user-1",
        poolName: "pool1",
        framedIpAddress: "10.0.0.1",
      };

      vi.mocked(mockRadiusRepository.addToIpPool).mockResolvedValue(
        mockIpPool as never,
      );

      const result = await radiusAdminService.addIpPool(input);

      expect(result).toEqual(mockIpPool);
      expect(mockRadiusRepository.addToIpPool).toHaveBeenCalled();
    });
  });

  describe("removeIpPool", () => {
    it("harus remove IP from pool", async () => {
      const input = {
        tenantId: "tenant-1",
        ipAddress: "10.0.0.1",
      };

      vi.mocked(mockRadiusRepository.removeFromIpPool).mockResolvedValue(
        undefined,
      );

      const result = await radiusAdminService.removeIpPool(input);

      expect(result.ipAddress).toBe("10.0.0.1");
      expect(mockRadiusRepository.removeFromIpPool).toHaveBeenCalledWith(
        "10.0.0.1",
        "tenant-1",
      );
    });
  });
});
