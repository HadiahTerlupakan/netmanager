import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  pasangRedisIdempotensiDiMemori,
  type RedisIdempotensiDiMemori,
} from "../helpers/redis-idempotensi-di-memori";

/**
 * Regresi Task 11c untuk SEMUA pemanggil helper idempotensi bersama
 * (`lib/api/idempotency.ts`): presurvei kegiatan, mobile leaves, mobile
 * overtime, serta mobile inventory masuk/keluar. `GenericIdempotencyService`
 * asli berjalan di atas Redis tiruan ber-TTL; hanya service bisnis tiap
 * route yang ditiru.
 */

const mockFns = vi.hoisted(() => ({
  catatKegiatan: vi.fn(),
  buatCuti: vi.fn(),
  buatLembur: vi.fn(),
  buatBarangMasuk: vi.fn(),
  buatBarangKeluar: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  type Skema = { parse: (nilai: unknown) => unknown };
  return {
    ...actual,
    // Sesi & izin tetap; body divalidasi skema bila route memintanya
    // (presurvei), sama seperti `createHandler` asli.
    createHandler:
      (opsi: { schema?: Skema }, handler: (...args: unknown[]) => unknown) =>
      async (req: NextRequest) =>
        handler(req, {
          session: { user: { id: "user-1", tenantId: "tenant-1" } },
          permissions: ["*"],
          validated: opsi.schema
            ? opsi.schema.parse(await req.clone().json())
            : undefined,
          params: {},
        }),
  };
});

vi.mock("@/modules/presurvei", async () => {
  const actual = await vi.importActual<typeof import("@/modules/presurvei")>(
    "@/modules/presurvei",
  );
  return {
    ...actual,
    KegiatanService: class {
      catat = mockFns.catatKegiatan;
    },
  };
});

vi.mock("@/modules/attendance", () => ({
  EmployeeLeaveQueryService: class {},
  MobileLeaveRequestService: class {
    createLeaveRequest = mockFns.buatCuti;
  },
}));

vi.mock("@/modules/overtime", () => ({
  OvertimeService: class {
    createRequest = mockFns.buatLembur;
  },
  OvertimeRouteService: class {},
}));

vi.mock("@/modules/inventory", () => ({
  getMobileInventoryService: () => ({
    createBarangMasuk: mockFns.buatBarangMasuk,
    createBarangKeluar: mockFns.buatBarangKeluar,
  }),
}));

import { redis } from "@/lib/redis";
import { POST as postKegiatan } from "@/app/api/presurvei/kegiatan/route";
import { POST as postCuti } from "@/app/api/mobile/leaves/route";
import { POST as postLembur } from "@/app/api/mobile/overtime/route";
import { POST as postBarangMasuk } from "@/app/api/mobile/inventory/masuk/route";
import { POST as postBarangKeluar } from "@/app/api/mobile/inventory/keluar/route";

// Literal terpisah dari konstanta produksi.
const TTL_SEDANG_DIPROSES_DETIK = 120;
const RETRY_AFTER_DETIK = "30";
const KUNCI = "req-11c-1";

type RoutePost = (req: NextRequest, ctx: never) => Promise<Response>;

interface KasusPemanggil {
  nama: string;
  route: RoutePost;
  url: string;
  badan: Record<string, unknown>;
  badanLain: Record<string, unknown>;
  tulis: Mock;
  hasilTulis: unknown;
  statusSukses: number;
}

const kegiatanTersimpan = {
  id: "kegiatan-1",
  jenis: "TELEPON",
  userId: "user-1",
  namaSales: null as string | null,
  peranPelaku: null as string | null,
  departemenPelaku: null as string | null,
  prospekId: null as string | null,
  iklanId: null as string | null,
  waktuMulai: new Date("2026-09-22T08:00:00.000Z"),
  waktuSelesai: null as Date | null,
  latitude: null as number | null,
  longitude: null as number | null,
  alamatDikunjungi: null as string | null,
  ditemuiNama: null as string | null,
  hasil: "TIDAK_MINAT",
  catatan: null as string | null,
  fotoUrls: [] as string[],
  odpTerdekat: null as string | null,
  estimasiKabelMeter: null as number | null,
  catatanTeknis: null as string | null,
  siteId: null as string | null,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-22T08:00:00.000Z"),
  updatedAt: new Date("2026-09-22T08:00:00.000Z"),
};

// Dihitung saat modul dimuat: skema kegiatan menolak waktu jauh dari jam server.
const waktuMulai = new Date().toISOString();

const DAFTAR_KASUS: KasusPemanggil[] = [
  {
    nama: "presurvei kegiatan",
    route: postKegiatan as unknown as RoutePost,
    url: "http://localhost/api/presurvei/kegiatan",
    badan: { jenis: "TELEPON", hasil: "TIDAK_MINAT", waktuMulai },
    badanLain: { jenis: "TELEPON", hasil: "TERTARIK", waktuMulai },
    tulis: mockFns.catatKegiatan,
    hasilTulis: { kegiatan: kegiatanTersimpan, prospek: null },
    statusSukses: 201,
  },
  {
    nama: "mobile leaves",
    route: postCuti as unknown as RoutePost,
    url: "http://localhost/api/mobile/leaves",
    badan: {
      type: "CUTI",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      reason: "acara keluarga",
    },
    badanLain: {
      type: "CUTI",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      reason: "acara keluarga",
    },
    tulis: mockFns.buatCuti,
    hasilTulis: { id: "cuti-1" },
    statusSukses: 201,
  },
  {
    nama: "mobile overtime",
    route: postLembur as unknown as RoutePost,
    url: "http://localhost/api/mobile/overtime",
    badan: { date: "2026-10-01", reason: "gangguan massal" },
    badanLain: { date: "2026-10-02", reason: "gangguan massal" },
    tulis: mockFns.buatLembur,
    hasilTulis: { id: "lembur-1" },
    statusSukses: 201,
  },
  {
    nama: "mobile inventory masuk",
    route: postBarangMasuk as unknown as RoutePost,
    url: "http://localhost/api/mobile/inventory/masuk",
    badan: { barangId: "barang-1", gudangId: "gudang-1", jumlah: 3 },
    badanLain: { barangId: "barang-1", gudangId: "gudang-1", jumlah: 4 },
    tulis: mockFns.buatBarangMasuk,
    hasilTulis: { id: "masuk-1" },
    statusSukses: 200,
  },
  {
    nama: "mobile inventory keluar",
    route: postBarangKeluar as unknown as RoutePost,
    url: "http://localhost/api/mobile/inventory/keluar",
    badan: { barangId: "barang-1", gudangId: "gudang-1", jumlah: 2 },
    badanLain: { barangId: "barang-1", gudangId: "gudang-1", jumlah: 5 },
    tulis: mockFns.buatBarangKeluar,
    hasilTulis: { id: "keluar-1" },
    statusSukses: 200,
  },
];

const kirim = (kasus: KasusPemanggil, badan: Record<string, unknown>) =>
  kasus.route(
    new NextRequest(kasus.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": KUNCI },
      body: JSON.stringify(badan),
    }),
    { params: Promise.resolve({}) } as never,
  );

/** Mulai POST yang handler-nya tak pernah selesai (pod mati di tengah proses). */
const mulaiPermintaanMenggantung = async (
  kasus: KasusPemanggil,
): Promise<void> => {
  kasus.tulis.mockImplementationOnce(() => new Promise(() => {}));
  void kirim(kasus, kasus.badan);
  await vi.waitFor(() => expect(kasus.tulis).toHaveBeenCalledTimes(1));
};

describe.each(DAFTAR_KASUS)("idempotensi $nama — Task 11c", (kasus) => {
  let redisTiruan: RedisIdempotensiDiMemori;

  beforeEach(() => {
    vi.clearAllMocks();
    kasus.tulis.mockReset();
    kasus.tulis.mockResolvedValue(kasus.hasilTulis);
    redisTiruan = pasangRedisIdempotensiDiMemori();
  });

  it("409 selagi diproses membawa kode IDEMPOTENCY_IN_PROGRESS + Retry-After", async () => {
    await mulaiPermintaanMenggantung(kasus);

    const respons = await kirim(kasus, kasus.badan);

    expect(respons.status).toBe(409);
    expect(respons.headers.get("Retry-After")).toBe(RETRY_AFTER_DETIK);
    expect(await respons.json()).toEqual(
      expect.objectContaining({
        success: false,
        code: "IDEMPOTENCY_IN_PROGRESS",
      }),
    );
  });

  it("kunci IN_PROGRESS yatim kedaluwarsa, lalu replay diproses sukses", async () => {
    await mulaiPermintaanMenggantung(kasus);

    redisTiruan.majukanWaktu(TTL_SEDANG_DIPROSES_DETIK);
    const respons = await kirim(kasus, kasus.badan);

    expect(respons.status).toBe(kasus.statusSukses);
    expect(kasus.tulis).toHaveBeenCalledTimes(2);
  });

  it("payload beda dengan kunci sama: 409 IDEMPOTENCY_KEY_REUSED tanpa Retry-After", async () => {
    await kirim(kasus, kasus.badan);

    const respons = await kirim(kasus, kasus.badanLain);

    expect(respons.status).toBe(409);
    expect(respons.headers.get("Retry-After")).toBeNull();
    expect((await respons.json()).code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(kasus.tulis).toHaveBeenCalledTimes(1);
  });

  it("persistCompleted gagal: klien tetap sukses, kunci tidak dilepas", async () => {
    vi.mocked(redis.setex).mockRejectedValueOnce(new Error("ECONNRESET"));

    const pertama = await kirim(kasus, kasus.badan);
    const replay = await kirim(kasus, kasus.badan);

    expect(pertama.status).toBe(kasus.statusSukses);
    expect(replay.status).toBe(409);
    expect((await replay.json()).code).toBe("IDEMPOTENCY_IN_PROGRESS");
    expect(kasus.tulis).toHaveBeenCalledTimes(1);
  });

  it("replay setelah sukses tetap memutar ulang respons tersimpan", async () => {
    const pertama = await kirim(kasus, kasus.badan);
    const replay = await kirim(kasus, kasus.badan);

    expect(replay.status).toBe(kasus.statusSukses);
    expect(replay.headers.get("X-Idempotent-Replay")).toBe("true");
    expect(await replay.json()).toEqual(await pertama.json());
    expect(kasus.tulis).toHaveBeenCalledTimes(1);
  });
});
