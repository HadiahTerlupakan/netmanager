import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInvestorFindUnique = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {},
  prismaAuth: {
    investor: { findUnique: mockInvestorFindUnique },
    user: { findUnique: mockUserFindUnique },
    pelanggan: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock("@/lib/prisma-mitra", () => ({
  prismaMitraAuth: { mitra: { findUnique: vi.fn().mockResolvedValue(null) } },
}));

import { signMobileToken, verifyMobileToken } from "@/lib/mobile-auth";
import {
  getInvestorMobileSession,
  signInvestorMobileTokens,
  verifyInvestorMobileToken,
} from "@/lib/mobile-investor-auth";

const IDENTITAS = {
  id: "inv-1",
  username: "pakbudi",
  namaLengkap: "Budi Santoso",
  tenantId: "tenant-1",
  tokenVersion: 2,
};

function investorDb(ubah: Partial<{ isActive: boolean; tokenVersion: number }> = {}) {
  return { ...IDENTITAS, isActive: true, ...ubah };
}

function requestBearer(token: string) {
  return new Request("http://localhost/api/mobile/investor/dashboard", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("token investor mobile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvestorFindUnique.mockResolvedValue(investorDb());
  });

  it("access token sah menghasilkan sesi investor dari data terbaru DB", async () => {
    const { token } = await signInvestorMobileTokens(IDENTITAS, { versionCode: 9 });

    await expect(verifyInvestorMobileToken(token, "access")).resolves.toEqual({
      id: "inv-1",
      username: "pakbudi",
      namaLengkap: "Budi Santoso",
      tenantId: "tenant-1",
    });
    expect(mockInvestorFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "inv-1" } }),
    );
  });

  it("refresh token tidak bisa dipakai sebagai access token, dan sebaliknya", async () => {
    const { token, refreshToken } = await signInvestorMobileTokens(IDENTITAS);

    await expect(verifyInvestorMobileToken(refreshToken, "access")).resolves.toBeNull();
    await expect(verifyInvestorMobileToken(token, "refresh")).resolves.toBeNull();
    await expect(verifyInvestorMobileToken(refreshToken, "refresh")).resolves.not.toBeNull();
  });

  it("akun nonaktif atau token yang sudah dicabut lewat logout ditolak", async () => {
    const { token } = await signInvestorMobileTokens(IDENTITAS);

    mockInvestorFindUnique.mockResolvedValueOnce(investorDb({ isActive: false }));
    await expect(verifyInvestorMobileToken(token, "access")).resolves.toBeNull();

    mockInvestorFindUnique.mockResolvedValueOnce(investorDb({ tokenVersion: 3 }));
    await expect(verifyInvestorMobileToken(token, "access")).resolves.toBeNull();

    mockInvestorFindUnique.mockResolvedValueOnce(null);
    await expect(verifyInvestorMobileToken(token, "access")).resolves.toBeNull();
  });

  it("token karyawan mobile tidak diterima sebagai token investor", async () => {
    mockUserFindUnique.mockResolvedValue({ tokenVersion: 0 });
    const tokenKaryawan = await signMobileToken({
      id: "user-1",
      email: "budi@example.com",
      role: "Teknisi",
      tenantId: "tenant-1",
    });

    await expect(verifyInvestorMobileToken(tokenKaryawan, "access")).resolves.toBeNull();
    expect(mockInvestorFindUnique).not.toHaveBeenCalled();
  });

  it("token investor ditolak verifier mobile karyawan/mitra/pelanggan", async () => {
    const { token } = await signInvestorMobileTokens(IDENTITAS);

    await expect(verifyMobileToken(token)).resolves.toBeNull();
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("getInvestorMobileSession membaca Bearer dan null tanpa header", async () => {
    const { token } = await signInvestorMobileTokens(IDENTITAS);

    await expect(getInvestorMobileSession(requestBearer(token))).resolves.toMatchObject({
      id: "inv-1",
    });
    await expect(
      getInvestorMobileSession(new Request("http://localhost/x")),
    ).resolves.toBeNull();
    await expect(getInvestorMobileSession(requestBearer("null"))).resolves.toBeNull();
  });
});
