import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ResponsiveTable } from "@/components/ui/ResponsiveTable";

/**
 * Penjaga kontrol halaman `ResponsiveTable`.
 *
 * `{totalPages && …}` merender angka `0` apa adanya bila `totalPages` bernilai
 * 0 — React mencetak angka falsy, tidak seperti `false`/`null`. Data kosong
 * tidak pernah sampai ke sini (keadaan kosong kembali lebih awal), jadi yang
 * diuji adalah data berisi dengan `totalPages: 0`.
 */

interface Baris {
  id: string;
  nama: string;
}

const BARIS: Baris[] = [{ id: "b1", nama: "Budi" }];
const KOLOM = [{ key: "nama", header: "Nama" }];

function renderTabel(totalPages: number | undefined): string {
  return renderToStaticMarkup(
    <ResponsiveTable<Baris>
      data={BARIS}
      columns={KOLOM}
      keyField="id"
      page={1}
      totalPages={totalPages}
      onPageChange={() => undefined}
    />,
  );
}

/** Teks yang tampil setelah nama baris terakhir — tempat kontrol halaman berada. */
function teksSetelahBaris(html: string): string {
  const teks = html.replace(/<[^>]+>/g, "|");
  return teks.slice(teks.lastIndexOf("Budi") + "Budi".length);
}

describe("ResponsiveTable — kontrol halaman", () => {
  it("tidak mencetak angka 0 mentah saat totalPages bernilai 0", () => {
    expect(teksSetelahBaris(renderTabel(0))).not.toMatch(/\|0\|/);
  });

  it("tidak memasang kontrol halaman untuk satu halaman", () => {
    expect(renderTabel(1)).not.toContain("Next");
  });

  it("memasang kontrol halaman bila halamannya lebih dari satu", () => {
    expect(renderTabel(3)).toContain("Next");
  });
});
