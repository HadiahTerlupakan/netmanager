import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFindRouterTenantId = vi.hoisted(() => vi.fn());
const mockFindPelangganWithRouter = vi.hoisted(() => vi.fn());
const mockFindRouterById = vi.hoisted(() => vi.fn());

vi.mock("@/modules/network/repositories/NetworkRepository", () => ({
  // This will be mocked at runtime
}));

vi.mock("@/modules/network/domain/ports/IMikroTikRouterRepository", () => ({
  // This will be mocked at runtime
}));

import { MikroTikRouterContextService } from "@/modules/network/services/mikrotik/MikroTikRouterContextService";
import type { RouterTenantId } from "@/modules/network/repositories/NetworkRepository";

function createService() {
  return new MikroTikRouterContextService({
    networkRepository: {
      findRouterTenantId: mockFindRouterTenantId,
      findPelangganWithRouter: mockFindPelangganWithRouter,
    },
    routerRepository: {
      findById: mockFindRouterById,
    },
  } as unknown as ConstructorParameters<
    typeof MikroTikRouterContextService
  >[0]);
}

describe("MikroTikRouterContextService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findRouter", () => {
    it("returns router entity when router exists and has tenant", async () => {
      const routerTenant: RouterTenantId = {
        tenantId: "tenant-1",
      };
      mockFindRouterTenantId.mockResolvedValueOnce(routerTenant);

      const mockRouter = {
        id: "router-1",
        ipAddress: "192.168.1.1",
        apiPort: 8728,
        apiUsername: "admin",
        apiUsernameGenerated: "api-user",
        apiPassword: "password",
        apiPasswordGenerated: "api-password",
      };
      mockFindRouterById.mockResolvedValueOnce(mockRouter);

      const service = createService();
      const result = await service.findRouter("router-1");

      expect(result).toEqual(mockRouter);
      expect(mockFindRouterTenantId).toHaveBeenCalledWith("router-1");
      expect(mockFindRouterById).toHaveBeenCalledWith("router-1", "tenant-1");
    });

    it("returns null when router tenant not found", async () => {
      mockFindRouterTenantId.mockResolvedValueOnce(null);

      const service = createService();
      const result = await service.findRouter("router-1");

      expect(result).toBeNull();
      expect(mockFindRouterTenantId).toHaveBeenCalledWith("router-1");
      expect(mockFindRouterById).not.toHaveBeenCalled();
    });

    it("returns null when router entity not found", async () => {
      const routerTenant: RouterTenantId = {
        tenantId: "tenant-1",
      };
      mockFindRouterTenantId.mockResolvedValueOnce(routerTenant);
      mockFindRouterById.mockResolvedValueOnce(null);

      const service = createService();
      const result = await service.findRouter("router-1");

      expect(result).toBeNull();
      expect(mockFindRouterTenantId).toHaveBeenCalledWith("router-1");
      expect(mockFindRouterById).toHaveBeenCalledWith("router-1", "tenant-1");
    });
  });

  describe("getRouterFromPelanggan", () => {
    it("returns complete context when pelanggan with router exists", async () => {
      const mockPelanggan = {
        id: "pelanggan-1",
        username: "customer1",
        password: "secret123",
        nama: "Customer One",
        hargaPaket: {
          profilePPP: {
            name: "basic-profile",
            mikroTikRouter: {
              id: "router-1",
              ipAddress: "192.168.1.1",
              apiPort: 8728,
              apiUsername: "admin",
              apiUsernameGenerated: "api-user",
              apiPassword: "password",
              apiPasswordGenerated: "api-password",
            },
          },
        },
      };
      mockFindPelangganWithRouter.mockResolvedValueOnce(mockPelanggan);

      const service = createService();
      const result = await service.getRouterFromPelanggan("pelanggan-1");

      expect(result).toEqual({
        router: {
          ipAddress: "192.168.1.1",
          apiPort: 8728,
          apiUsername: "api-user",
          apiPassword: "api-password",
        },
        routerId: "router-1",
        pelanggan: {
          username: "customer1",
          password: "secret123",
          nama: "Customer One",
        },
        profileName: "basic-profile",
      });
      expect(mockFindPelangganWithRouter).toHaveBeenCalledWith("pelanggan-1");
    });

    it("prefers generated API credentials over master credentials", async () => {
      const mockPelanggan = {
        id: "pelanggan-1",
        username: "customer1",
        password: "secret123",
        nama: "Customer One",
        hargaPaket: {
          profilePPP: {
            name: "basic-profile",
            mikroTikRouter: {
              id: "router-1",
              ipAddress: "192.168.1.1",
              apiPort: 8728,
              apiUsername: "master-admin",
              apiUsernameGenerated: "generated-api-user",
              apiPassword: "master-password",
              apiPasswordGenerated: "generated-api-password",
            },
          },
        },
      };
      mockFindPelangganWithRouter.mockResolvedValueOnce(mockPelanggan);

      const service = createService();
      const result = await service.getRouterFromPelanggan("pelanggan-1");

      expect(result).toEqual({
        router: {
          ipAddress: "192.168.1.1",
          apiPort: 8728,
          apiUsername: "generated-api-user",
          apiPassword: "generated-api-password",
        },
        routerId: "router-1",
        pelanggan: {
          username: "customer1",
          password: "secret123",
          nama: "Customer One",
        },
        profileName: "basic-profile",
      });
    });

    it("returns null when pelanggan not found", async () => {
      mockFindPelangganWithRouter.mockResolvedValueOnce(null);

      const service = createService();
      const result = await service.getRouterFromPelanggan("pelanggan-1");

      expect(result).toBeNull();
      expect(mockFindPelangganWithRouter).toHaveBeenCalledWith("pelanggan-1");
    });

    it("returns null when pelanggan has no hargaPaket profilePPP mikroTikRouter", async () => {
      const mockPelanggan: Record<string, unknown> = {
        id: "pelanggan-1",
        username: "customer1",
        password: "secret123",
        nama: "Customer One",
        hargaPaket: {
          profilePPP: {
            name: "basic-profile",
            // mikroTikRouter is missing
          },
        },
      };
      mockFindPelangganWithRouter.mockResolvedValueOnce(mockPelanggan);

      const service = createService();
      const result = await service.getRouterFromPelanggan("pelanggan-1");

      expect(result).toBeNull();
      expect(mockFindPelangganWithRouter).toHaveBeenCalledWith("pelanggan-1");
    });

    it("returns null when hargaPaket or profilePPP is missing", async () => {
      const mockPelanggan: Record<string, unknown> = {
        id: "pelanggan-1",
        username: "customer1",
        password: "secret123",
        nama: "Customer One",
        hargaPaket: undefined,
      };
      mockFindPelangganWithRouter.mockResolvedValueOnce(mockPelanggan);

      const service = createService();
      const result = await service.getRouterFromPelanggan("pelanggan-1");

      expect(result).toBeNull();
      expect(mockFindPelangganWithRouter).toHaveBeenCalledWith("pelanggan-1");
    });

    it("returns null when pelanggan object is incomplete", async () => {
      const mockPelanggan: Record<string, unknown> = {
        id: "pelanggan-1",
        username: "customer1",
        password: "secret123",
        // nama is missing
        hargaPaket: {
          profilePPP: {
            name: "basic-profile",
            mikroTikRouter: {
              id: "router-1",
              ipAddress: "192.168.1.1",
              apiPort: 8728,
              apiUsername: "admin",
              apiUsernameGenerated: undefined,
              apiPassword: "password",
              apiPasswordGenerated: undefined,
            },
          },
        },
      };
      mockFindPelangganWithRouter.mockResolvedValueOnce(mockPelanggan);

      const service = createService();
      const result = await service.getRouterFromPelanggan("pelanggan-1");

      expect(result).toEqual({
        router: {
          ipAddress: "192.168.1.1",
          apiPort: 8728,
          apiUsername: "admin",
          apiPassword: "password",
        },
        routerId: "router-1",
        pelanggan: {
          username: "customer1",
          password: "secret123",
          nama: undefined,
        },
        profileName: "basic-profile",
      });
    });
  });
});
