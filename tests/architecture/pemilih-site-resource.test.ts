import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Setiap pemilih site yang memanggil `GET /api/sites` (langsung, atau lewat
 * `<SiteFilter>`) wajib mengirim `resource` milik modul yang datanya disaring
 * atau ditugaskan — sama dengan resource yang dibaca `checkSiteRestriction` /
 * `lingkupSiteUntuk` di route modul itu. Tanpa `resource` berarti modulnya
 * tidak menegakkan `site_only`, sehingga seluruh site tenant ditampilkan;
 * pemilih seperti itu harus tercatat eksplisit di sini (`null`).
 *
 * Pemanggil baru yang belum tercatat membuat tes ini gagal — putuskan dulu
 * resource-nya, jangan biarkan jatuh ke "semua site" tanpa sengaja.
 */

/** Jalur berkas → resource yang diharapkan per pemanggilan (urut kemunculan). */
const PEMANGGIL_DIHARAPKAN: Record<string, (string | null)[]> = {
  // GET/POST /api/bandwidths → BandwidthRouteService: "bandwidth"
  "app/admin/paket/bandwidth/components/BandwidthTable.tsx": ["bandwidth"],
  "app/admin/paket/bandwidth/components/BandwidthFormModal.tsx": ["bandwidth"],
  // GET /api/profileppps & profile-ppp-validation: "profileppp"
  "app/admin/paket/profileppp/components/ProfilePppFormModal.tsx": [
    "profileppp",
  ],
  "app/admin/paket/profileppp/components/ProfilePppTable.tsx": ["profileppp"],
  // GET/POST /api/hargapakets: "harga"
  "app/admin/paket/harga/components/HargaTable.tsx": ["harga"],
  // MarketingCanvasingListRouteService: "canvasing:site_only"
  "app/admin/marketing/canvasing/CanvasingListHeader.tsx": ["canvasing"],
  // GET /api/admin/system-logs: "system_log"
  "app/admin/log/activity/ActivityLogClient.tsx": ["system_log"],
  // GET/POST /api/pelanggan-ppp: "pelanggan"
  "app/admin/pelanggan/ppp/PppList.tsx": ["pelanggan"],
  "app/admin/pelanggan/ppp/components/info/PppClientSiteSection.tsx": [
    "pelanggan",
  ],
  // expense-site-scope / RabProjectSiteAccessService: "expense"
  "app/admin/pengeluaran/ExpensesClient.tsx": ["expense"],
  "app/admin/proyek/ProyekClient.tsx": ["expense"],
  // GET/POST /api/admin/mitra: "mitra"
  "app/admin/mitra/hooks/useMitraList.ts": ["mitra"],
  // Insiden menyimpan nama area dan tidak menegakkan site_only.
  "app/admin/incidents/AffectedAreaPicker.tsx": [null],
  // Pembungkus generik: meneruskan prop `resource` dari pemanggilnya.
  "components/common/SiteFilterRedirect.tsx": ["{resource}"],
};

/** Komponen dasar yang membangun URL `/api/sites` dari prop `resource`. */
const IMPLEMENTASI_DASAR = "components/common/SiteFilter.tsx";

const DIREKTORI_DIPINDAI = ["app", "components", "hooks", "lib"];

function kumpulkanBerkas(direktori: string): string[] {
  let entri: string[];
  try {
    entri = readdirSync(direktori);
  } catch {
    return [];
  }
  return entri.flatMap((nama) => {
    const jalur = join(direktori, nama);
    if (statSync(jalur).isDirectory()) return kumpulkanBerkas(jalur);
    return /\.tsx?$/.test(nama) ? [jalur] : [];
  });
}

/** Ambil isi tag JSX `<SiteFilter ... />`, termasuk yang multi-baris. */
function tagSiteFilter(sumber: string): string[] {
  return [...sumber.matchAll(/<SiteFilter\b([\s\S]*?)\/>/g)].map((m) => m[1]);
}

function resourceDariTag(atribut: string): string | null {
  const literal = atribut.match(/\bresource=["']([^"']+)["']/);
  if (literal) return literal[1];
  const ekspresi = atribut.match(/\bresource=\{\s*([\w.]+)\s*\}/);
  return ekspresi ? `{${ekspresi[1]}}` : null;
}

/** URL literal `/api/sites` (bukan `/api/sites/...`) beserta resource-nya. */
function resourceDariUrl(sumber: string): (string | null)[] {
  const kode = sumber.replace(/^\s*(\/\/|\*).*$/gm, "");
  return [...kode.matchAll(/["'`]\/api\/sites(\?[^"'`]*)?["'`]/g)].map((m) =>
    new URLSearchParams(m[1] ?? "").get("resource"),
  );
}

function pemanggilAktual(): Record<string, (string | null)[]> {
  const hasil: Record<string, (string | null)[]> = {};
  for (const jalur of DIREKTORI_DIPINDAI.flatMap(kumpulkanBerkas)) {
    const relatif = relative(process.cwd(), jalur);
    if (relatif === IMPLEMENTASI_DASAR || relatif.startsWith("app/api/")) {
      continue;
    }
    const sumber = readFileSync(jalur, "utf8");
    const resources = [
      ...tagSiteFilter(sumber).map(resourceDariTag),
      ...resourceDariUrl(sumber),
    ];
    if (resources.length > 0) hasil[relatif] = resources;
  }
  return hasil;
}

describe("pemilih site mengirim resource modul yang disaringnya", () => {
  it("setiap pemanggil /api/sites tercatat dengan resource yang tepat", () => {
    expect(pemanggilAktual()).toEqual(PEMANGGIL_DIHARAPKAN);
  });
});
