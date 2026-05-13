import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isolateCustomerOnRouter,
  unIsolateCustomerOnRouter,
} from "@/modules/network/services/mikrotik-ppp-secret.lifecycle";

const mockSetSecretProfile = vi.fn();
const mockDisconnectSession = vi.fn();
const mockCreateSecret = vi.fn();
const mockDeleteSecret = vi.fn();
const mockGetRouterFromPelanggan = vi.fn();

function buildDeps(overrides: Record<string, unknown> = {}) {
  return {
    routerContextService: {
      getRouterFromPelanggan: mockGetRouterFromPelanggan,
    } as never,
    createSecret: mockCreateSecret,
    setSecretProfile: mockSetSecretProfile,
    disconnectSession: mockDisconnectSession,
    deleteSecret: mockDeleteSecret,
    expiredProfile: "EXPIRED",
    ...overrides,
  };
}

describe("mikrotik-ppp-secret.lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRouterFromPelanggan.mockResolvedValue({
      router: { ipAddress: "192.168.1.1" },
      routerId: "router-1",
      pelanggan: { username: "budi123", password: "pwd", nama: "Budi" },
      profileName: "REGULER",
    });
  });

  describe("isolateCustomerOnRouter", () => {
    it("return failure ketika PPP Secret tidak ditemukan", async () => {
      mockSetSecretProfile.mockResolvedValue({
        success: false,
        error: "PPP Secret tidak ditemukan",
      });

      const result = await isolateCustomerOnRouter("cust-1", buildDeps());

      expect(result.success).toBe(false);
      expect(result.error).toBe("PPP Secret tidak ditemukan");
      // disconnectSession tidak boleh dipanggil jika profile gagal diubah
      expect(mockDisconnectSession).not.toHaveBeenCalled();
    });

    it("return failure untuk error setSecretProfile selain PPP Secret tidak ditemukan", async () => {
      mockSetSecretProfile.mockResolvedValue({
        success: false,
        error: "Connection timeout",
      });

      const result = await isolateCustomerOnRouter("cust-1", buildDeps());

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection timeout");
      expect(mockDisconnectSession).not.toHaveBeenCalled();
    });

    it("return success ketika profile berhasil di-update dan session disconnect", async () => {
      mockSetSecretProfile.mockResolvedValue({ success: true });
      mockDisconnectSession.mockResolvedValue({
        success: true,
        disconnected: 1,
      });

      const result = await isolateCustomerOnRouter("cust-1", buildDeps());

      expect(result.success).toBe(true);
      expect(mockSetSecretProfile).toHaveBeenCalledWith(
        "router-1",
        "budi123",
        "EXPIRED",
      );
      expect(mockDisconnectSession).toHaveBeenCalledWith("router-1", "budi123");
    });

    it("return failure ketika pelanggan atau router tidak ditemukan", async () => {
      mockGetRouterFromPelanggan.mockResolvedValue(null);

      const result = await isolateCustomerOnRouter("cust-1", buildDeps());

      expect(result.success).toBe(false);
      expect(result.error).toBe("Pelanggan atau router tidak ditemukan");
    });
  });

  describe("unIsolateCustomerOnRouter", () => {
    it("return failure ketika PPP Secret tidak ditemukan", async () => {
      mockSetSecretProfile.mockResolvedValue({
        success: false,
        error: "PPP Secret tidak ditemukan",
      });

      const result = await unIsolateCustomerOnRouter("cust-1", buildDeps());

      expect(result.success).toBe(false);
      expect(result.error).toBe("PPP Secret tidak ditemukan");
      // disconnectSession tidak boleh dipanggil jika profile gagal dikembalikan
      expect(mockDisconnectSession).not.toHaveBeenCalled();
    });

    it("return failure untuk error setSecretProfile selain PPP Secret tidak ditemukan", async () => {
      mockSetSecretProfile.mockResolvedValue({
        success: false,
        error: "Router unreachable",
      });

      const result = await unIsolateCustomerOnRouter("cust-1", buildDeps());

      expect(result.success).toBe(false);
      expect(result.error).toBe("Router unreachable");
      expect(mockDisconnectSession).not.toHaveBeenCalled();
    });

    it("return success dan restore profile normal", async () => {
      mockSetSecretProfile.mockResolvedValue({ success: true });
      mockDisconnectSession.mockResolvedValue({
        success: true,
        disconnected: 2,
      });

      const result = await unIsolateCustomerOnRouter("cust-1", buildDeps());

      expect(result.success).toBe(true);
      expect(mockSetSecretProfile).toHaveBeenCalledWith(
        "router-1",
        "budi123",
        "REGULER",
      );
      expect(mockDisconnectSession).toHaveBeenCalledWith("router-1", "budi123");
    });

    it("return failure ketika pelanggan atau router tidak ditemukan", async () => {
      mockGetRouterFromPelanggan.mockResolvedValue(null);

      const result = await unIsolateCustomerOnRouter("cust-1", buildDeps());

      expect(result.success).toBe(false);
      expect(result.error).toBe("Pelanggan atau router tidak ditemukan");
    });
  });
});
