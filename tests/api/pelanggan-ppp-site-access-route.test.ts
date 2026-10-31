import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock } from "../setup";

/**
 * Pembatasan `pelanggan:site_only` dibaca dari `session.user.permissions`,
 * sedangkan `ctx.session` dari `createHandler` tidak membawa izin. Route yang
 * meneruskan `ctx.session` apa adanya membuat pemeriksaan site selalu lolos.
 * Tes ini menjalankan route sungguhan sampai Prisma palsu yang menyaring
 * `where`, jadi "tidak ada yang ditulis" berarti baris benar-benar utuh.
 */

const palsu = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  renewCurrentCycle: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: palsu.getServerSession }));

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  authOptions: {},
  getUserPermissions: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/modules/database", () => ({ prisma: prismaMock }));

vi.mock("@/modules/events", () => ({
  CustomerEventDispatcher: {
    onUpdated: vi.fn().mockResolvedValue(undefined),
    onActivated: vi.fn().mockResolvedValue(undefined),
    onIsolated: vi.fn().mockResolvedValue(undefined),
    onSuspended: vi.fn().mockResolvedValue(undefined),
    onDeleted: vi.fn().mockResolvedValue(undefined),
  },
  BillingEventDispatcher: { onPackageChanged: vi.fn() },
}));

vi.mock("@/modules/finance", () => ({
  CustomerRenewalService: class {
    renewCurrentCycle = palsu.renewCurrentCycle;
  },
  CustomerRenewalError: class extends Error {},
}));

import {
  DELETE as deletePelanggan,
  GET as getPelanggan,
  PUT as putPelanggan,
} from "@/app/api/pelanggan-ppp/[id]/route";
import { POST as postRenew } from "@/app/api/pelanggan-ppp/[id]/renew/route";
import { POST as postCancelPending } from "@/app/api/pelanggan-ppp/[id]/cancel-pending-package/route";
import { GET as getTagihan } from "@/app/api/tagihan/pelanggan/[id]/route";

type Row = Record<string, unknown> & { id: string };

const IZIN_ADMIN_SITE = [
  "pelanggan:read",
  "pelanggan:update",
  "pelanggan:delete",
  "payments:create",
  "pelanggan:site_only",
];

let rows: Row[];

const pelangganRow = (id: string, siteId: string): Row => ({
  id,
  tenantId: "tenant-1",
  siteId,
  idPelanggan: `KODE-${id}`,
  nama: `Pelanggan ${id}`,
  username: `pppoe-${id}`,
  password: "rahasia",
  passwordHash: null,
  hargaPaketId: "paket-1",
  tipe: "REGULER",
  status: "AKTIF",
  autoIsolir: true,
  email: null,
  odpId: null,
  catatan: null,
  pendingPackageId: "paket-2",
  tanggalAktif: new Date("2026-01-01"),
  jatuhTempo: new Date("2026-11-01"),
});

const cocok = (row: Row, where: Record<string, unknown>) =>
  Object.entries(where).every(([key, value]) => row[key] === value);

const rowOf = (id: string) => rows.find((row) => row.id === id);

function pasangPrismaPalsu() {
  const cari = async ({ where }: { where: Record<string, unknown> }) => {
    const row = rows.find((candidate) => cocok(candidate, where));
    return row ? { ...row } : null;
  };
  prismaMock.pelanggan.findFirst.mockImplementation(cari);
  prismaMock.pelanggan.findUnique.mockImplementation(cari);
  prismaMock.pelanggan.update.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const row = rows.find((candidate) => cocok(candidate, where));
      if (!row) throw new Error("Record to update not found");
      Object.assign(row, data);
      return { ...row };
    },
  );
  prismaMock.pelanggan.delete.mockImplementation(
    async ({ where }: { where: Record<string, unknown> }) => {
      const index = rows.findIndex((candidate) => cocok(candidate, where));
      if (index < 0) throw new Error("Record to delete not found");
      return rows.splice(index, 1)[0];
    },
  );
  prismaMock.invoice.findMany.mockResolvedValue([]);
}

function sesiAdminSite1() {
  palsu.getServerSession.mockResolvedValue({
    user: {
      id: "admin-site-1",
      email: "admin@example.com",
      role: "ADMIN_SITE",
      tenantId: "tenant-1",
      isSuperAdmin: false,
      siteId: "site-1",
      siteIds: ["site-1"],
      permissions: IZIN_ADMIN_SITE,
    },
  });
}

const konteks = (id: string) => ({ params: Promise.resolve({ id }) });

function jsonRequest(method: string, path: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function putRequest(id: string) {
  const form = new FormData();
  const fields: Record<string, string> = {
    idPelanggan: `KODE-${id}`,
    nama: "Nama Baru",
    username: `pppoe-${id}`,
    password: "",
    hargaPaketId: "paket-1",
    tipe: "REGULER",
    tanggalAktif: "2026-01-01",
    jatuhTempo: "2026-11-01",
    status: "AKTIF",
    autoIsolir: "true",
    siteId: String(rowOf(id)?.siteId ?? ""),
  };
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new NextRequest(`http://localhost/api/pelanggan-ppp/${id}`, {
    method: "PUT",
    body: form,
  });
}

describe("rute pelanggan-ppp — admin terbatas site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows = [
      pelangganRow("pel-own", "site-1"),
      pelangganRow("pel-other", "site-2"),
    ];
    pasangPrismaPalsu();
    palsu.renewCurrentCycle.mockResolvedValue({ invoiceId: "inv-1" });
    sesiAdminSite1();
  });

  describe("PUT /api/pelanggan-ppp/[id]", () => {
    it("403 untuk pelanggan di site lain dan barisnya utuh", async () => {
      const response = await putPelanggan(
        putRequest("pel-other"),
        konteks("pel-other"),
      );

      expect(response.status).toBe(403);
      expect(rowOf("pel-other")?.nama).toBe("Pelanggan pel-other");
      expect(prismaMock.pelanggan.update).not.toHaveBeenCalled();
    });

    it("mengubah pelanggan di site sendiri", async () => {
      const response = await putPelanggan(
        putRequest("pel-own"),
        konteks("pel-own"),
      );

      expect(response.status).toBe(200);
      expect(rowOf("pel-own")?.nama).toBe("Nama Baru");
    });
  });

  describe("DELETE /api/pelanggan-ppp/[id]", () => {
    it("403 untuk pelanggan di site lain dan barisnya tidak terhapus", async () => {
      const response = await deletePelanggan(
        jsonRequest("DELETE", "/api/pelanggan-ppp/pel-other"),
        konteks("pel-other"),
      );

      expect(response.status).toBe(403);
      expect(rowOf("pel-other")).toBeDefined();
    });

    it("menghapus pelanggan di site sendiri", async () => {
      const response = await deletePelanggan(
        jsonRequest("DELETE", "/api/pelanggan-ppp/pel-own"),
        konteks("pel-own"),
      );

      expect(response.status).toBe(200);
      expect(rowOf("pel-own")).toBeUndefined();
    });
  });

  describe("GET /api/pelanggan-ppp/[id]", () => {
    it("403 untuk pelanggan di site lain", async () => {
      const response = await getPelanggan(
        jsonRequest("GET", "/api/pelanggan-ppp/pel-other"),
        konteks("pel-other"),
      );

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/pelanggan-ppp/[id]/renew", () => {
    const body = { statusBayar: "LUNAS", paymentMethod: "CASH" };

    it("403 untuk pelanggan di site lain tanpa menagih", async () => {
      const response = await postRenew(
        jsonRequest("POST", "/api/pelanggan-ppp/pel-other/renew", body),
        konteks("pel-other"),
      );

      expect(response.status).toBe(403);
      expect(palsu.renewCurrentCycle).not.toHaveBeenCalled();
    });

    it("memperpanjang pelanggan di site sendiri", async () => {
      const response = await postRenew(
        jsonRequest("POST", "/api/pelanggan-ppp/pel-own/renew", body),
        konteks("pel-own"),
      );

      expect(response.status).toBe(200);
      expect(palsu.renewCurrentCycle).toHaveBeenCalledWith(
        expect.objectContaining({ pelangganId: "pel-own" }),
      );
    });
  });

  describe("POST /api/pelanggan-ppp/[id]/cancel-pending-package", () => {
    it("403 untuk pelanggan di site lain dan paket terjadwal tetap ada", async () => {
      const response = await postCancelPending(
        jsonRequest(
          "POST",
          "/api/pelanggan-ppp/pel-other/cancel-pending-package",
        ),
        konteks("pel-other"),
      );

      expect(response.status).toBe(403);
      expect(rowOf("pel-other")?.pendingPackageId).toBe("paket-2");
    });

    it("membatalkan paket terjadwal pelanggan di site sendiri", async () => {
      const response = await postCancelPending(
        jsonRequest(
          "POST",
          "/api/pelanggan-ppp/pel-own/cancel-pending-package",
        ),
        konteks("pel-own"),
      );

      expect(response.status).toBe(200);
      expect(rowOf("pel-own")?.pendingPackageId).toBeNull();
    });
  });

  describe("GET /api/tagihan/pelanggan/[id]", () => {
    it("403 untuk pelanggan di site lain", async () => {
      const response = await getTagihan(
        jsonRequest("GET", "/api/tagihan/pelanggan/pel-other"),
        konteks("pel-other"),
      );

      expect(response.status).toBe(403);
    });

    it("membaca tagihan pelanggan di site sendiri", async () => {
      const response = await getTagihan(
        jsonRequest("GET", "/api/tagihan/pelanggan/pel-own"),
        konteks("pel-own"),
      );

      expect(response.status).toBe(200);
    });
  });
});
