import { describe, expect, it } from "vitest";
import {
  HASIL_PER_JENIS,
  isHasilSesuaiJenis,
  labelHasilKegiatan,
} from "@/modules/presurvei/domain/hasil-kegiatan";
import { isHasilMelahirkanProspek } from "@/modules/presurvei/domain/kegiatan-rules";
import { catatKegiatanSchema } from "@/modules/presurvei/validators/kegiatan.validator";

describe("hasil kegiatan per jenis", () => {
  it("survei lokasi menawarkan kelayakan pasang, bukan tertarik/deal", () => {
    expect(HASIL_PER_JENIS.SURVEI_LOKASI).toEqual([
      "BISA_DIPASANG",
      "TIDAK_BISA_DIPASANG",
      "PERLU_FOLLOWUP",
      "TIDAK_ADA_ORANG",
    ]);
    expect(HASIL_PER_JENIS.TELEPON).not.toContain("BISA_DIPASANG");
  });

  it("label mengikuti jenis kegiatan", () => {
    expect(labelHasilKegiatan("TIDAK_ADA_ORANG", "TELEPON")).toBe("Tidak diangkat / nomor tidak aktif");
    expect(labelHasilKegiatan("TIDAK_ADA_ORANG", "CHAT")).toBe("Belum dibalas");
    expect(labelHasilKegiatan("TIDAK_ADA_ORANG", "KUNJUNGAN")).toBe("Tidak ketemu orangnya");
    expect(labelHasilKegiatan("PERLU_FOLLOWUP", "SURVEI_LOKASI")).toBe("Perlu dicek ulang");
    expect(labelHasilKegiatan("DEAL", "KUNJUNGAN")).toBe("Setuju pasang");
    // Jenis tanpa label khusus memakai label umum.
    expect(labelHasilKegiatan("TIDAK_ADA_ORANG", "IKLAN")).toBe("Tidak ada orang");
  });

  it("hasil khusus survei ditolak di jenis lain; kombinasi lama tetap diterima", () => {
    expect(isHasilSesuaiJenis("BISA_DIPASANG", "SURVEI_LOKASI")).toBe(true);
    expect(isHasilSesuaiJenis("BISA_DIPASANG", "TELEPON")).toBe(false);
    // Aplikasi lama mengirim survei "Tertarik": jangan ditolak.
    expect(isHasilSesuaiJenis("TERTARIK", "SURVEI_LOKASI")).toBe(true);
  });

  it("lokasi yang bisa dipasang melahirkan prospek; yang tidak bisa, tidak", () => {
    expect(isHasilMelahirkanProspek("BISA_DIPASANG")).toBe(true);
    expect(isHasilMelahirkanProspek("TIDAK_BISA_DIPASANG")).toBe(false);
  });

  it("validator menolak 'bisa dipasang' pada telepon", () => {
    const dasar = { jenis: "TELEPON", waktuMulai: new Date("2026-10-01T03:00:00Z"), hasil: "BISA_DIPASANG" };
    const hasil = catatKegiatanSchema.safeParse(dasar);
    expect(hasil.success).toBe(false);
    expect(hasil.error?.issues.some((isu) => isu.path.includes("hasil"))).toBe(true);
  });
});
