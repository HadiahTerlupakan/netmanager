import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCompare = vi.hoisted(() => vi.fn());
const mockSignTokens = vi.hoisted(() => vi.fn());
const mockVerifyToken = vi.hoisted(() => vi.fn());

vi.mock("bcryptjs", () => ({ compare: mockCompare }));
vi.mock("@/lib/mobile-investor-auth", () => ({
  INVESTOR_MOBILE_ROLE: "INVESTOR",
  signInvestorMobileTokens: mockSignTokens,
  verifyInvestorMobileToken: mockVerifyToken,
}));
vi.mock("@/modules/database", () => ({ prismaAuth: {} }));

import { MobileInvestorAuthService } from "@/modules/investor/services/MobileInvestorAuthService";
import type { InvestorRepository } from "@/modules/investor/repositories/InvestorRepository";

const INVESTOR = {
  id: "inv-1",
  username: "pakbudi",
  namaLengkap: "Budi Santoso",
  perusahaan: "PT Maju",
  noTelp: "0812",
  email: null as string | null,
  passwordHash: "hash",
  isActive: true,
  tokenVersion: 0,
  tenantId: "tenant-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const repo = {
  findByLoginIdentifier: vi.fn(),
  findById: vi.fn(),
  incrementTokenVersion: vi.fn(),
};
const service = new MobileInvestorAuthService(repo as unknown as InvestorRepository);
const LOGIN = { email: " PakBudi ", password: "rahasia", versionCode: 12, versionName: "1.2" };

describe("MobileInvestorAuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findByLoginIdentifier.mockResolvedValue(INVESTOR);
    repo.findById.mockResolvedValue(INVESTOR);
    mockCompare.mockResolvedValue(true);
    mockSignTokens.mockResolvedValue({ token: "akses", refreshToken: "segar" });
  });

  it("login sukses dengan username/email (dipangkas) mengembalikan token dan profil investor", async () => {
    const hasil = await service.tryLogin(LOGIN);

    expect(repo.findByLoginIdentifier).toHaveBeenCalledWith("PakBudi");
    expect(mockSignTokens).toHaveBeenCalledWith(INVESTOR, { versionCode: 12, versionName: "1.2" });
    expect(hasil).toEqual({
      found: true,
      success: true,
      data: {
        token: "akses",
        refreshToken: "segar",
        user: {
          id: "inv-1",
          name: "Budi Santoso",
          email: "pakbudi",
          username: "pakbudi",
          role: "INVESTOR",
          tenantId: "tenant-1",
          perusahaan: "PT Maju",
          noTelp: "0812",
          features: [],
        },
      },
    });
  });

  it("bukan investor atau belum punya password → found:false agar rantai login lanjut", async () => {
    repo.findByLoginIdentifier.mockResolvedValueOnce(null);
    await expect(service.tryLogin(LOGIN)).resolves.toEqual({ found: false });

    repo.findByLoginIdentifier.mockResolvedValueOnce({ ...INVESTOR, passwordHash: null });
    await expect(service.tryLogin(LOGIN)).resolves.toEqual({ found: false });
    expect(mockSignTokens).not.toHaveBeenCalled();
  });

  it("akun nonaktif → 403, password salah → 401, tanpa token", async () => {
    repo.findByLoginIdentifier.mockResolvedValueOnce({ ...INVESTOR, isActive: false });
    await expect(service.tryLogin(LOGIN)).resolves.toMatchObject({ success: false, status: 403 });

    mockCompare.mockResolvedValueOnce(false);
    await expect(service.tryLogin(LOGIN)).resolves.toMatchObject({ success: false, status: 401 });
    expect(mockSignTokens).not.toHaveBeenCalled();
  });

  it("refresh menerbitkan token baru hanya untuk refresh token investor sah dan akun aktif", async () => {
    mockVerifyToken.mockResolvedValueOnce(null);
    await expect(service.refresh("bukan-investor")).resolves.toBeNull();

    mockVerifyToken.mockResolvedValueOnce({ id: "inv-1" });
    repo.findById.mockResolvedValueOnce({ ...INVESTOR, isActive: false });
    await expect(service.refresh("segar")).resolves.toBeNull();

    mockVerifyToken.mockResolvedValueOnce({ id: "inv-1" });
    await expect(service.refresh("segar", { versionCode: 13 })).resolves.toEqual({
      token: "akses",
      refreshToken: "segar",
    });
    expect(mockVerifyToken).toHaveBeenLastCalledWith("segar", "refresh");
    expect(mockSignTokens).toHaveBeenLastCalledWith(INVESTOR, { versionCode: 13 });
  });

  it("logout menaikkan tokenVersion; profil hanya untuk akun aktif", async () => {
    await service.logout("inv-1");
    expect(repo.incrementTokenVersion).toHaveBeenCalledWith("inv-1");

    await expect(service.getProfile("inv-1")).resolves.toMatchObject({ role: "INVESTOR" });
    repo.findById.mockResolvedValueOnce({ ...INVESTOR, isActive: false });
    await expect(service.getProfile("inv-1")).resolves.toBeNull();
  });
});
