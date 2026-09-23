import { describe, expect, it, vi } from "vitest";

import { penutupModalDitahanSaatMenyimpan } from "@/app/admin/presurvei/penutupModal";

/** Dipindah dari presurvei-target-form-state.test.ts bersama fungsinya. */
describe("penutupModalDitahanSaatMenyimpan", () => {
  it("meneruskan penutup asli selama tidak menyimpan", () => {
    const tutup = vi.fn();

    penutupModalDitahanSaatMenyimpan(false, tutup)();

    expect(tutup).toHaveBeenCalledTimes(1);
  });

  it("menahan penutupan selama penyimpanan berjalan", () => {
    // Menutup di tengah simpan membuka jalan bagi modal berikutnya ditutup
    // oleh `onBerhasil` milik permintaan sebelumnya.
    const tutup = vi.fn();

    penutupModalDitahanSaatMenyimpan(true, tutup)();

    expect(tutup).not.toHaveBeenCalled();
  });
});
