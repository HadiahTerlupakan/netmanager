// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Kabel `batasRentangTanggal` ke atribut DOM kedua medan tanggal.
 *
 * `batasRentangTanggal` sudah diuji sebagai fungsi murni di
 * `presurvei-kegiatan-list-query.test.ts`. Itu menjaga ISI fungsinya, bukan
 * titik pakainya: menukar `max={batas.maksDariTanggal}` dengan
 * `min={batas.minSampaiTanggal}` di JSX `KegiatanFilters` lolos `tsc`, lint,
 * dan seluruh suite, lalu membalik penjaga rentang jadi kebalikan tujuannya —
 * ia memaksa `dari >= sampai`, sehingga SETIAP rentang yang bisa dibentuk
 * pemakai adalah rentang terbalik yang selalu mengembalikan nol baris tanpa
 * satu pun pesan.
 *
 * Komponennya murni presentasional — props masuk, JSX keluar — jadi tidak ada
 * yang perlu di-mock: tanpa fetch, tanpa QueryClientProvider, tanpa router.
 * Pola render mengikuti `tests/app/admin/canvasing-list.test.tsx`: `createRoot`
 * + `act`, tanpa `@testing-library` (repo ini tidak memakainya).
 */

import { KegiatanFilters } from "@/app/admin/presurvei/kegiatan/KegiatanFilters";
import type { FilterKegiatan } from "@/app/admin/presurvei/kegiatan/kegiatanListQuery";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const FILTER_KOSONG: FilterKegiatan = {
  page: 1,
  userId: "",
  jenis: "",
  hasil: "",
  dariTanggal: "",
  sampaiTanggal: "",
};

/** Selektor stabil: `aria-label` yang sudah dipakai komponennya. */
const LABEL_DARI = "Kegiatan sejak tanggal";
const LABEL_SAMPAI = "Kegiatan sampai tanggal";

describe("KegiatanFilters", () => {
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

  async function render(ubahan: Partial<FilterKegiatan>) {
    await act(async () => {
      root.render(
        <KegiatanFilters
          filter={{ ...FILTER_KOSONG, ...ubahan }}
          idSalesTersedia={[]}
          onUbah={() => undefined}
        />,
      );
    });
  }

  function medanTanggal(label: string): HTMLInputElement {
    const medan = container.querySelector(
      `input[type="date"][aria-label="${label}"]`,
    ) as HTMLInputElement;

    expect(medan).not.toBeNull();
    return medan;
  }

  it("memasang ujung atas rentang sebagai `max` medan 'dari' saja", async () => {
    // Sengaja ASIMETRIS: hanya `sampaiTanggal` yang terisi. Kalau kedua atribut
    // tertukar di JSX, nilainya pindah ke medan yang salah DAN sisi satunya
    // jadi kosong — dua assertion di bawah merah sekaligus, bukan bertukar diam.
    await render({ sampaiTanggal: "2026-09-30" });

    expect(medanTanggal(LABEL_DARI).getAttribute("max")).toBe("2026-09-30");
    expect(medanTanggal(LABEL_SAMPAI).getAttribute("min")).toBeNull();
  });

  it("memasang ujung bawah rentang sebagai `min` medan 'sampai' saja", async () => {
    await render({ dariTanggal: "2026-09-01" });

    expect(medanTanggal(LABEL_SAMPAI).getAttribute("min")).toBe("2026-09-01");
    expect(medanTanggal(LABEL_DARI).getAttribute("max")).toBeNull();
  });

  it("membatasi kedua medan saat rentang terisi penuh", async () => {
    // Dua tanggal berbeda jauh: kalau keduanya kembar, tertukarnya tak terlihat.
    await render({ dariTanggal: "2026-09-01", sampaiTanggal: "2026-09-30" });

    expect(medanTanggal(LABEL_DARI).getAttribute("max")).toBe("2026-09-30");
    expect(medanTanggal(LABEL_SAMPAI).getAttribute("min")).toBe("2026-09-01");
  });

  it("tidak membatasi apa pun saat kedua medan kosong", async () => {
    await render({});

    expect(medanTanggal(LABEL_DARI).getAttribute("max")).toBeNull();
    expect(medanTanggal(LABEL_SAMPAI).getAttribute("min")).toBeNull();
  });
});
