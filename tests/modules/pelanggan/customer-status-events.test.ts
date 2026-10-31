import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pelanggan, Status } from "@prisma/client";

import { prismaMock } from "../../setup";
import { PelangganService } from "@/modules/pelanggan/services/PelangganService";
import { PelangganAdminMutationService } from "@/modules/pelanggan/services/PelangganAdminMutationService";

/**
 * Notifikasi isolir dulu selalu berbunyi "karena tunggakan", termasuk saat
 * admin mengisolir pelanggan yang tidak punya tagihan lewat jatuh tempo.
 * Alasan isolir kini ditentukan saat event diterbitkan: tunggakan hanya bila
 * memang ada tagihan lewat jatuh tempo, dan tagihan itu ikut di payload.
 */

const mockFns = vi.hoisted(() => ({
  findOverdueInvoiceForPelanggan: vi.fn(),
  onIsolated: vi.fn(),
  onActivated: vi.fn(),
  onSuspended: vi.fn(),
  onUpdated: vi.fn(),
}));

vi.mock("@/modules/finance", () => ({
  FinanceRepositoryFacade: {
    findOverdueInvoiceForPelanggan: mockFns.findOverdueInvoiceForPelanggan,
  },
}));

vi.mock("@/modules/events", () => ({
  CustomerEventDispatcher: {
    onIsolated: mockFns.onIsolated,
    onActivated: mockFns.onActivated,
    onSuspended: mockFns.onSuspended,
    onUpdated: mockFns.onUpdated,
  },
}));

vi.mock("@/modules/database", () => ({ prisma: prismaMock }));

const PELANGGAN_AKTIF = {
  id: "pel-1",
  idPelanggan: "10000001",
  nama: "Budi",
  username: "budi",
  password: "pppoe",
  passwordHash: null as string | null,
  hargaPaketId: "pkg-1",
  tipe: "REGULER",
  status: "AKTIF",
  autoIsolir: true,
  siteId: null as string | null,
  odpId: null as string | null,
  email: null as string | null,
  tenantId: "tenant-1",
  tanggalAktif: new Date("2026-01-01"),
  jatuhTempo: new Date("2026-11-01"),
};

const TUNGGAKAN = { invoiceNumber: "INV/2026/10/0001", amountDue: 150000 };

function siapkanBarisPelanggan() {
  prismaMock.pelanggan.findUnique.mockResolvedValueOnce(
    PELANGGAN_AKTIF as unknown as Pelanggan,
  );
  prismaMock.pelanggan.update.mockResolvedValueOnce({
    ...PELANGGAN_AKTIF,
    status: "ISOLIR",
  } as unknown as Pelanggan);
}

describe("alasan isolir di event CUSTOMER_ISOLATED", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aksi baris Isolir pada pelanggan menunggak menyertakan tagihannya", async () => {
    mockFns.findOverdueInvoiceForPelanggan.mockResolvedValueOnce(TUNGGAKAN);
    siapkanBarisPelanggan();

    await new PelangganService().updateStatusPelanggan(
      "pel-1",
      "ISOLIR" as Status,
    );

    expect(mockFns.findOverdueInvoiceForPelanggan).toHaveBeenCalledWith(
      "pel-1",
    );
    expect(mockFns.onIsolated).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "pel-1",
        newStatus: "ISOLIR",
        arrearsInvoiceNumber: "INV/2026/10/0001",
        arrearsAmount: 150000,
      }),
    );
  });

  it("aksi baris Isolir tanpa tagihan lewat jatuh tempo tidak menyebut tunggakan", async () => {
    mockFns.findOverdueInvoiceForPelanggan.mockResolvedValueOnce(null);
    siapkanBarisPelanggan();

    await new PelangganService().updateStatusPelanggan(
      "pel-1",
      "ISOLIR" as Status,
    );

    const payload = mockFns.onIsolated.mock.calls[0][0];
    expect(payload).not.toHaveProperty("arrearsInvoiceNumber");
    expect(payload).not.toHaveProperty("arrearsAmount");
  });

  it("gagal membaca tagihan tetap menerbitkan event, tanpa klaim tunggakan", async () => {
    mockFns.findOverdueInvoiceForPelanggan.mockRejectedValueOnce(
      new Error("billing DB down"),
    );
    siapkanBarisPelanggan();

    await new PelangganService().updateStatusPelanggan(
      "pel-1",
      "ISOLIR" as Status,
    );

    expect(mockFns.onIsolated).toHaveBeenCalledOnce();
    expect(mockFns.onIsolated.mock.calls[0][0]).not.toHaveProperty(
      "arrearsInvoiceNumber",
    );
  });

  it("form Edit Pelanggan yang mengisolir juga menyertakan tagihannya", async () => {
    mockFns.findOverdueInvoiceForPelanggan.mockResolvedValueOnce(TUNGGAKAN);
    const repository = {
      findForAdminMutation: vi.fn().mockResolvedValue(PELANGGAN_AKTIF),
      updateAdminPppById: vi
        .fn()
        .mockResolvedValue({ ...PELANGGAN_AKTIF, status: "ISOLIR" }),
    };

    await new PelangganAdminMutationService(repository as never).updatePppById(
      {
        id: "pel-1",
        session: {
          user: { tenantId: "tenant-1", isSuperAdmin: false, role: null },
        },
        data: {
          idPelanggan: "10000001",
          nama: "Budi",
          username: "budi",
          password: "",
          hargaPaketId: "pkg-1",
          tipe: "REGULER",
          tanggalAktif: "2026-01-01",
          jatuhTempo: "2026-11-01",
          status: "ISOLIR",
          autoIsolir: true,
          email: null,
          siteId: null,
          invoiceAction: null,
          passwordLogin: null,
        },
      },
    );

    expect(mockFns.onIsolated).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "pel-1",
        arrearsInvoiceNumber: "INV/2026/10/0001",
        arrearsAmount: 150000,
      }),
    );
  });
});
