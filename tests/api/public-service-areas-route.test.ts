import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/modules/database", () => ({
  prisma: { sites: { findMany: (...args: unknown[]) => findMany(...args) } },
}));

/**
 * Halaman registrasi publik menawarkan saran "Area / Lokasi". Sumber lamanya
 * `/api/odcs/locations` membaca `Odc.location`, dan tabel `Odc` tidak pernah
 * ditulis oleh apa pun di aplikasi ini — sarannya selalu kosong. Sumbernya
 * kini `Sites`, yang bisa dijawab calon pelanggan dan aman tampil publik.
 */
describe("GET /api/public/service-areas", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("mengembalikan nama site aktif sebagai daftar area", async () => {
    findMany.mockResolvedValue([{ name: "Bekasi" }, { name: "Cikarang" }]);

    const { GET } = await import("@/app/api/public/service-areas/route");
    const body = await (await GET()).json();

    expect(body.data).toEqual(["Bekasi", "Cikarang"]);
  });

  // Site nonaktif bukan area layanan; menawarkannya menyesatkan calon pelanggan.
  it("hanya mengambil site aktif, terurut, tanpa duplikat nama", async () => {
    findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/public/service-areas/route");
    await GET();

    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { name: true },
      distinct: ["name"],
      orderBy: { name: "asc" },
    });
  });

  it("mengembalikan daftar kosong saat belum ada site", async () => {
    findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/public/service-areas/route");
    const body = await (await GET()).json();

    expect(body.data).toEqual([]);
  });
});
