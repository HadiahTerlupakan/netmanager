import { describe, expect, it } from "vitest";
import {
  INTERNAL_MOBILE_RESOURCES,
  PERMISSION_GROUPS_MOBILE,
} from "@/lib/permission-config";
import { getResourceCapabilities } from "@/lib/resource-capabilities";
import { ROLE_TEMPLATES } from "@/lib/role-templates";
import {
  IZIN_INTI_PER_PERSONA,
  IZIN_STANDAR_MOBILE_PER_PERSONA,
  PERSONA_KARYAWAN,
  RESOURCE_MOBILE_MATRIKS,
  RESOURCE_MOBILE_PER_PERSONA,
  formatPeringatanIzinInti,
  getIzinIntiHilang,
  getIzinTakTerlihatDiHp,
  isResourceMobileRelevan,
  terapkanIzinStandarMobile,
} from "@/modules/roles/client";

/**
 * Relevansi izin mobile per persona — pemetaan dibaca dari kode
 * `mobile-netmanager` (tab bar, Beranda, menu cepat per persona).
 */

const RESOURCE_MATRIKS_LIB = Object.values(PERMISSION_GROUPS_MOBILE).flat();

/** Bagian mobile matriks sebuah template role (+ m_dashboard). */
function getIzinMobileTemplate(id: string): string[] {
  const template = ROLE_TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error(`template ${id} tidak ada`);
  return template.permissions.filter((p) => p.startsWith("m_"));
}

describe("izin mobile per persona", () => {
  it("resource matriks sama persis dengan PERMISSION_GROUPS_MOBILE", () => {
    expect([...RESOURCE_MOBILE_MATRIKS].sort()).toEqual(
      [...RESOURCE_MATRIKS_LIB].sort(),
    );
  });

  it("resource internal tidak pernah masuk matriks", () => {
    for (const internal of INTERNAL_MOBILE_RESOURCES) {
      expect(RESOURCE_MOBILE_MATRIKS as readonly string[]).not.toContain(
        internal,
      );
    }
  });

  it("memetakan relevansi sesuai tampilan mobile", () => {
    expect(RESOURCE_MOBILE_PER_PERSONA.TEKNISI).toEqual(RESOURCE_MOBILE_MATRIKS);
    expect([...RESOURCE_MOBILE_PER_PERSONA.SALES].sort()).toEqual(
      [
        "m_absensi",
        "m_canvasing",
        "m_chat",
        "m_holidays",
        "m_izin",
        "m_presurvei",
      ].sort(),
    );
    expect([...RESOURCE_MOBILE_PER_PERSONA.STAFF].sort()).toEqual(
      [
        "m_absensi",
        "m_chat",
        "m_holidays",
        "m_izin",
        "m_lembur",
        "m_presurvei",
      ].sort(),
    );
    expect(RESOURCE_MOBILE_PER_PERSONA.FINANCE).toEqual(
      RESOURCE_MOBILE_PER_PERSONA.STAFF,
    );
    expect(RESOURCE_MOBILE_PER_PERSONA.DIREKTUR).toEqual(
      RESOURCE_MOBILE_PER_PERSONA.STAFF,
    );
  });

  it("sales tidak memakai lembur, work order, barang, topologi, pelanggan", () => {
    for (const resource of [
      "m_lembur",
      "m_work_order",
      "m_barang",
      "m_topology",
      "m_pelanggan",
    ]) {
      expect(isResourceMobileRelevan("SALES", resource)).toBe(false);
    }
  });

  it("staff tidak memakai work order, barang, maupun canvasing", () => {
    for (const resource of ["m_work_order", "m_barang", "m_canvasing"]) {
      expect(isResourceMobileRelevan("STAFF", resource)).toBe(false);
    }
  });

  it("izin inti tiap persona selalu relevan dan termasuk preset standar", () => {
    for (const persona of PERSONA_KARYAWAN) {
      for (const { izin } of IZIN_INTI_PER_PERSONA[persona]) {
        const resource = izin.split(":")[0];
        if (resource !== "m_dashboard") {
          expect(isResourceMobileRelevan(persona, resource)).toBe(true);
        }
        expect(IZIN_STANDAR_MOBILE_PER_PERSONA[persona]).toContain(izin);
      }
    }
  });

  it("preset hanya memuat izin relevan dengan aksi yang didukung resource", () => {
    for (const persona of PERSONA_KARYAWAN) {
      for (const izin of IZIN_STANDAR_MOBILE_PER_PERSONA[persona]) {
        const [resource, aksi] = izin.split(":");
        expect(getResourceCapabilities(resource)).toContain(aksi);
        if (resource !== "m_dashboard") {
          expect(isResourceMobileRelevan(persona, resource)).toBe(true);
        }
      }
    }
  });

  it("preset Teknisi & Sales sama dengan bagian mobile template role", () => {
    expect([...IZIN_STANDAR_MOBILE_PER_PERSONA.TEKNISI].sort()).toEqual(
      getIzinMobileTemplate("teknisi").sort(),
    );
    expect([...IZIN_STANDAR_MOBILE_PER_PERSONA.SALES].sort()).toEqual(
      getIzinMobileTemplate("sales").sort(),
    );
  });

  it("template role tidak memuat izin mobile yang tak terlihat di persona-nya", () => {
    const pelanggar = ROLE_TEMPLATES.filter(
      (t) => getIzinTakTerlihatDiHp(t.persona, t.permissions).length > 0,
    ).map((t) => t.id);
    // Setiap izin mobile di template harus punya menu di HP persona-nya.
    expect(pelanggar).toEqual([]);
  });
});

describe("terapkanIzinStandarMobile", () => {
  it("hanya mengganti izin m_* matriks; izin web & internal dipertahankan", () => {
    const hasil = terapkanIzinStandarMobile("SALES", [
      "pelanggan:read",
      "workorders:update",
      "m_salary:read",
      "m_work_order:read",
      "m_barang:read",
      "m_lembur:create",
    ]);
    expect(hasil).toContain("pelanggan:read");
    expect(hasil).toContain("workorders:update");
    expect(hasil).toContain("m_salary:read");
    expect(hasil).not.toContain("m_work_order:read");
    expect(hasil).not.toContain("m_barang:read");
    expect(hasil).not.toContain("m_lembur:create");
    expect(hasil.filter((p) => p.startsWith("m_") && p !== "m_salary:read").sort()).toEqual(
      [...IZIN_STANDAR_MOBILE_PER_PERSONA.SALES].sort(),
    );
  });

  it("tidak menggandakan izin yang sudah ada", () => {
    const hasil = terapkanIzinStandarMobile("STAFF", [
      "m_dashboard:read",
      "m_absensi:read",
    ]);
    expect(hasil.length).toBe(new Set(hasil).size);
  });
});

describe("peringatan izin mobile", () => {
  it("mendaftar izin tercentang yang tak terlihat di HP persona", () => {
    expect(
      getIzinTakTerlihatDiHp("SALES", [
        "m_work_order:read",
        "m_presurvei:read",
        "m_salary:read",
        "pelanggan:read",
        "m_lembur:create",
      ]),
    ).toEqual(["m_work_order:read", "m_lembur:create"]);
    expect(getIzinTakTerlihatDiHp("TEKNISI", ["m_lembur:read"])).toEqual([]);
  });

  it("melaporkan izin inti yang hilang dengan kalimat jelas", () => {
    const hilang = getIzinIntiHilang("TEKNISI", ["m_dashboard:read"]);
    expect(hilang.map((i) => i.izin)).toEqual(["m_work_order:read"]);
    expect(formatPeringatanIzinInti("TEKNISI", hilang[0])).toBe(
      "Tampilan Teknisi tanpa izin Work Order: Beranda teknisi akan kosong.",
    );
    expect(
      getIzinIntiHilang("SALES", IZIN_STANDAR_MOBILE_PER_PERSONA.SALES),
    ).toEqual([]);
    expect(getIzinIntiHilang("STAFF", []).map((i) => i.izin)).toEqual([
      "m_dashboard:read",
      "m_absensi:read",
    ]);
  });
});
