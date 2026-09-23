// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Kabel `keteranganPeta` ke paragraf yang benar-benar sampai ke DOM.
 *
 * Isi kalimatnya sudah diuji sebagai fungsi murni di
 * `presurvei-titik-peta.test.ts`. Yang dikunci di sini adalah titik pakainya,
 * dan ada dua cara ia bisa salah tanpa ditolak `tsc`:
 *
 * 1. **Kedua hitungan tertukar** — `tanpaKoordinat` dan `diLuarBatas`
 *    bersebelahan dan keduanya `number`, kelas cacat nomor 3 di batasan
 *    global. Kalimatnya tetap terbentuk, hanya angkanya yang berbohong.
 * 2. **Array dirender tanpa `.map`** — React mencetak array string apa adanya
 *    sebagai satu blok tanpa spasi, dan `tsc` menerimanya.
 *
 * Komponennya murni presentasional: nol `vi.mock`, nol provider, nol fetch,
 * nol timer. Biaya render jsdom ditentukan itu, bukan oleh kepentingan
 * kabelnya — diukur di Task 7 pada `presurvei-kegiatan-filters.test.tsx`.
 * Sengaja TIDAK merender `KegiatanPeta` sendiri: komponen itu membangun peta
 * OpenLayers di atas kanvas yang tidak dipunyai jsdom, sehingga menjangkaunya
 * menuntut belasan mock modul `ol` yang tidak menegaskan apa pun tentang
 * petanya — lebih mahal daripada nilainya, bukan tak terjangkau.
 */

import { KegiatanPetaKeterangan } from "@/app/admin/presurvei/kegiatan/KegiatanPetaKeterangan";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("KegiatanPetaKeterangan", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
  });

  async function render(tanpaKoordinat: number, diLuarBatas: number) {
    await act(async () => {
      root.render(
        <KegiatanPetaKeterangan
          tanpaKoordinat={tanpaKoordinat}
          diLuarBatas={diLuarBatas}
        />,
      );
    });
  }

  function teksParagraf(): string[] {
    return [...container.querySelectorAll("p")].map(
      (elemen) => elemen.textContent ?? "",
    );
  }

  it("diam total saat seluruh kegiatan tergambar", async () => {
    await render(0, 0);

    expect(teksParagraf()).toEqual([]);
    expect(container.textContent).toBe("");
  });

  it("menuliskan tiap sebab sebagai paragrafnya sendiri", async () => {
    // Angka sengaja berbeda jauh: kalau kedua prop tertukar saat diteruskan ke
    // `keteranganPeta`, kalimatnya tetap muncul dan hanya angkanya yang salah.
    await render(4, 37);

    const paragraf = teksParagraf();

    expect(paragraf).toHaveLength(2);
    expect(paragraf[0]).toMatch(/^4 kegiatan tidak tergambar/);
    expect(paragraf[1]).toMatch(/^37 kegiatan lain/);
  });

  it("menuliskan satu paragraf saja saat hanya satu sebab berlaku", async () => {
    await render(0, 37);

    expect(teksParagraf()).toHaveLength(1);
    expect(teksParagraf()[0]).toMatch(/^37 kegiatan lain/);
  });
});
