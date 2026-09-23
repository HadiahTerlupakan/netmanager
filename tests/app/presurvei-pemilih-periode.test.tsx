// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kabel `PemilihPeriode`: bulan dan tahun dua `<select>` bersebelahan yang
 * sama-sama mengirim `number`. Menukar `ubah({ bulan })` dengan
 * `ubah({ tahun })` di JSX lolos `tsc` dan seluruh test fungsi murni, lalu
 * layar target dan laporan meminta periode "bulan 2025" yang ditolak server.
 *
 * Komponennya presentasional — tanpa fetch, tanpa provider — jadi render
 * jsdom murah (pola `presurvei-kegiatan-filters.test.tsx`).
 */

import { PemilihPeriode } from "@/app/admin/presurvei/PemilihPeriode";
import type { Periode } from "@/app/admin/presurvei/periode";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const LABEL_BULAN = "Bulan periode";
const LABEL_TAHUN = "Tahun periode";

describe("PemilihPeriode", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-15T05:00:00.000Z"));
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
    vi.useRealTimers();
  });

  async function render(periode: Periode, onUbah = vi.fn()) {
    await act(async () => {
      root.render(<PemilihPeriode periode={periode} onUbah={onUbah} />);
    });
    return onUbah;
  }

  function pemilih(label: string): HTMLSelectElement {
    const elemen = container.querySelector(
      `select[aria-label="${label}"]`,
    ) as HTMLSelectElement;
    expect(elemen).not.toBeNull();
    return elemen;
  }

  async function pilih(label: string, nilai: string) {
    const elemen = pemilih(label);
    await act(async () => {
      elemen.value = nilai;
      elemen.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("menampilkan periode yang sedang dipilih di pemilih yang benar", async () => {
    // Bulan dan tahun sengaja jauh berbeda supaya tertukarnya terlihat.
    await render({ tahun: 2025, bulan: 3 });

    expect(pemilih(LABEL_BULAN).value).toBe("3");
    expect(pemilih(LABEL_TAHUN).value).toBe("2025");
  });

  it("menawarkan dua belas bulan bernama dan tahun di sekitar tahun berjalan", async () => {
    await render({ tahun: 2026, bulan: 6 });

    const bulan = [...pemilih(LABEL_BULAN).options].map((o) => [
      o.value,
      o.textContent,
    ]);
    expect(bulan[0]).toEqual(["1", "Januari"]);
    expect(bulan).toHaveLength(12);
    expect([...pemilih(LABEL_TAHUN).options].map((o) => o.value)).toEqual([
      "2024",
      "2025",
      "2026",
      "2027",
    ]);
  });

  it("mengirim bulan sebagai angka saat bulan diganti", async () => {
    const onUbah = await render({ tahun: 2026, bulan: 6 });

    await pilih(LABEL_BULAN, "11");

    expect(onUbah).toHaveBeenCalledWith({ bulan: 11 });
  });

  it("mengirim tahun sebagai angka saat tahun diganti", async () => {
    const onUbah = await render({ tahun: 2026, bulan: 6 });

    await pilih(LABEL_TAHUN, "2024");

    expect(onUbah).toHaveBeenCalledWith({ tahun: 2024 });
  });
});
