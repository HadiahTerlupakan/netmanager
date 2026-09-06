import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Halaman login admin juga dilayani di apex (`radpro.id/admin/login`), dan
 * tautan "Login Admin" di landing page mengarah ke sana. Tanpa `COOKIE_DOMAIN`
 * cookie sesi bersifat host-only: login di apex menaruh cookie pada
 * `radpro.id`, lalu aplikasi memindahkan pengguna ke `admin.radpro.id` — host
 * yang tidak punya cookie itu — sehingga pengguna dilempar balik ke halaman
 * login dan harus masuk dua kali.
 */
function readManifest(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("kontrak cakupan cookie sesi", () => {
  it("configmap produksi menetapkan COOKIE_DOMAIN lintas subdomain", () => {
    const yaml = readManifest("k8s/production/configmap.yaml");

    expect(yaml).toMatch(/COOKIE_DOMAIN:\s*"\.radpro\.id"/);
  });

  // Nilainya harus diawali titik agar berlaku untuk seluruh subdomain, bukan
  // hanya apex.
  it("COOKIE_DOMAIN mencakup subdomain, bukan hanya domain apex", () => {
    const yaml = readManifest("k8s/production/configmap.yaml");
    const nilai = /COOKIE_DOMAIN:\s*"([^"]+)"/.exec(yaml)?.[1];

    expect(nilai?.startsWith(".")).toBe(true);
  });

  // Deployment membaca seluruh configmap lewat envFrom; tanpa itu penambahan
  // di configmap tidak akan sampai ke container.
  it("deployment produksi memuat configmap lewat envFrom", () => {
    const yaml = readManifest("k8s/production/app-deployment.yaml");

    expect(yaml).toContain("envFrom:");
    expect(yaml).toContain("name: netmanager-config");
  });
});
