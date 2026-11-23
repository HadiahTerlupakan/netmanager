import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { OpnameHistoryTable } from "@/components/inventory/opname/history/OpnameHistoryTable";
import { OpnameStatsCards } from "@/components/inventory/opname/history/OpnameStatsCards";
import {
  buildOpnameListQuery,
  clampOpnamePage,
  EMPTY_OPNAME_FILTERS,
  type OpnameHistoryRecord,
} from "@/components/inventory/opname/history/useOpnameHistory";

function buildRecord(
  overrides: Partial<OpnameHistoryRecord>,
): OpnameHistoryRecord {
  return {
    id: "op-1",
    barangId: "b1",
    gudangId: "g1",
    stokFisik: 8,
    stokSistem: 10,
    selisih: -2,
    keterangan: null,
    kondisiBaik: 8,
    kondisiRusak: 0,
    kondisiExpire: 0,
    lokasiPenyimpanan: null,
    nomorRak: null,
    nomorBox: null,
    pic: null,
    suhuPenyimpanan: null,
    kelembaban: null,
    tanggalExpire: null,
    nomorBatch: null,
    catatanDetail: null,
    alasanSelisih: "hilang",
    createdAt: "2026-11-23T03:00:00.000Z",
    barang: { id: "b1", kode: "BRG-1", nama: "Kabel", satuan: "meter" },
    gudang: { id: "g1", kode: "G1", nama: "Gudang Utama" },
    ...overrides,
  };
}

describe("OpnameHistoryTable", () => {
  it("menampilkan Edit/Hapus hanya untuk opname terakhir dan tanpa tombol View", () => {
    const html = renderToStaticMarkup(
      <OpnameHistoryTable
        data={[
          buildRecord({ id: "op-baru", isTerbaru: true }),
          buildRecord({ id: "op-lama", isTerbaru: false }),
        ]}
        loading={false}
        deletingId={null}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(html).not.toContain("View Detail");
    expect(html).toContain('title="Edit"');
    expect(html).toContain('title="Hapus"');
    expect(html).toContain("Bukan opname terakhir");
  });

  it("tidak menampilkan aksi untuk baris yang bukan opname terakhir", () => {
    const html = renderToStaticMarkup(
      <OpnameHistoryTable
        data={[buildRecord({ isTerbaru: false })]}
        loading={false}
        deletingId={null}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(html).not.toContain('title="Edit"');
    expect(html).not.toContain('title="Hapus"');
  });
});

describe("OpnameStatsCards", () => {
  it("menyebut perlu perhatian sebagai jumlah catatan", () => {
    const html = renderToStaticMarkup(
      <OpnameStatsCards
        stats={{
          totalRecords: 5,
          totalSelisihNol: 2,
          akurasiPercent: 40,
          totalKondisiBaik: 30,
          totalKondisiRusak: 2,
          totalKondisiExpire: 0,
          totalHilang: 3,
          totalPerluPerhatian: 2,
        }}
      />,
    );

    expect(html).toContain("Catatan Perlu Perhatian");
    expect(html).toContain("Jumlah catatan dengan barang rusak atau hilang");
    expect(html).toContain("bukan stok saat ini");
  });
});

describe("useOpnameHistory helpers", () => {
  it("menurunkan halaman ke halaman terakhir bila melebihi total halaman", () => {
    expect(clampOpnamePage(3, 2)).toBe(2);
    expect(clampOpnamePage(2, 2)).toBe(2);
    expect(clampOpnamePage(1, 0)).toBe(1);
  });

  it("menyusun query list dengan filter, halaman, dan limit", () => {
    const query = new URLSearchParams(
      buildOpnameListQuery(
        { ...EMPTY_OPNAME_FILTERS, gudangId: "g1", tanggalMulai: "2026-11-01" },
        2,
        1000,
      ),
    );

    expect(Object.fromEntries(query)).toEqual({
      gudangId: "g1",
      tanggalMulai: "2026-11-01",
      page: "2",
      limit: "1000",
    });
  });
});
