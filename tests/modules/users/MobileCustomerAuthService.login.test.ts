import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Kontrak login mobile untuk pelanggan.
 *
 * Jalur ini sebelumnya tidak punya satu pun pengujian, sementara karyawan dan
 * investor punya. Akibatnya pencatatan versi aplikasi bisa menulis
 * `lastOtaUpdateId` dan `lastLoginAt` — dua kolom yang hanya ada di `User` —
 * tanpa ada yang merah: setiap login pelanggan melempar validasi Prisma dan
 * route menjawab 500, dan itu baru ketahuan saat QA perangkat mencobanya.
 */

const prismaMock = {
  pelanggan: {
    findFirst: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock("@/modules/database", () => ({ prismaAuth: prismaMock }));
vi.mock("bcryptjs", () => ({
  compare: vi.fn(() => Promise.resolve(true)),
  hash: vi.fn(() => Promise.resolve("$2a$10$hash")),
}));
vi.mock("@/lib/jwt", () => ({
  createPelangganSessionId: () => "sesi-1",
  generatePelangganAccessToken: vi.fn(() => "token-akses"),
  generatePelangganRefreshToken: vi.fn(() => Promise.resolve("token-refresh")),
  verifyPelangganRefreshToken: vi.fn(),
}));

const PELANGGAN: {
  id: string;
  idPelanggan: string;
  nama: string;
  username: string;
  email: string | null;
  status: string;
  tenantId: string | null;
  password: string | null;
  passwordHash: string | null;
  alamat: string | null;
  hargaPaket: { name: string };
} = {
  id: "plg-1",
  idPelanggan: "10000001",
  nama: "Budi Santoso",
  username: "plgqa",
  email: "pelanggan@example.com",
  status: "AKTIF",
  tenantId: "tenant-1",
  password: null,
  passwordHash: "$2a$10$hash",
  alamat: "Jl. Uji QA No. 7",
  hargaPaket: { name: "Paket Basic 10 Mbps" },
};

const kolomPelanggan = new Set(Object.keys(Prisma.PelangganScalarFieldEnum));

describe("login mobile pelanggan", () => {
  let MobileCustomerAuthService: typeof import("@/modules/users/services/MobileCustomerAuthService").MobileCustomerAuthService;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ MobileCustomerAuthService } =
      await import("@/modules/users/services/MobileCustomerAuthService"));
    prismaMock.pelanggan.findFirst.mockResolvedValue(PELANGGAN as never);
    prismaMock.pelanggan.update.mockResolvedValue({} as never);
  });

  const login = () =>
    new MobileCustomerAuthService().tryLogin({
      email: "plgqa",
      password: "pelanggan123",
      versionCode: 42,
      versionName: "1.0.9",
      otaUpdateId: "update-abc",
    } as never);

  it("mengirim identitas pelanggan beserta paketnya", async () => {
    const hasil = await login();

    if (!hasil.found || !hasil.success) {
      throw new Error("login pelanggan seharusnya berhasil");
    }
    expect(hasil.data.user).toMatchObject({
      role: "CUSTOMER",
      name: "Budi Santoso",
      memberId: "10000001",
      planName: "Paket Basic 10 Mbps",
    });
    expect(hasil.data.token).toBe("token-akses");
    expect(hasil.data.refreshToken).toBe("token-refresh");
  });

  // Penjaga inti: apa pun yang ditulis saat login harus kolom Pelanggan asli.
  it("mencatat versi aplikasi hanya ke kolom yang ada di Pelanggan", async () => {
    await login();

    expect(prismaMock.pelanggan.update).toHaveBeenCalledTimes(1);
    const data = prismaMock.pelanggan.update.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    const takDikenal = Object.keys(data).filter((k) => !kolomPelanggan.has(k));

    expect(takDikenal).toEqual([]);
    expect(data.lastVersionCode).toBe(42);
  });

  it("menolak password yang salah tanpa mencatat versi", async () => {
    const bcrypt = await import("bcryptjs");
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

    const hasil = await login();

    expect(hasil).toMatchObject({ found: true, success: false, status: 401 });
    expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
  });

  it("menolak pelanggan dismantle dengan pesan dan kode yang menjelaskan", async () => {
    prismaMock.pelanggan.findFirst.mockResolvedValueOnce({
      ...PELANGGAN,
      status: "DISMANTLE",
    } as never);

    const hasil = await login();

    expect(hasil).toEqual({
      found: true,
      success: false,
      status: 403,
      error:
        "Layanan Anda sudah berhenti berlangganan. Hubungi admin bila ini keliru.",
      code: "CUSTOMER_DISMANTLED",
    });
    expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
  });

  it("melewati pencatatan versi bila aplikasi tidak melaporkan versinya", async () => {
    await new MobileCustomerAuthService().tryLogin({
      email: "plgqa",
      password: "pelanggan123",
      versionCode: 0,
      versionName: null,
    } as never);

    expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
  });
});
