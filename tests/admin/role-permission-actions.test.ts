import { describe, expect, it } from "vitest";

import {
  getCapabilityActions,
  getScopeActions,
  isScopeAction,
} from "@/app/admin/settings/roles/[id]/role-permission-actions";

/**
 * Tombol "Semua" pada satu resource di halaman Hak Akses dulu ikut menyalakan
 * `site_only`/`department_only`. Akibatnya menekan tombol yang terbaca "beri
 * semua akses" justru MENGURANGI jangkauan data role.
 *
 * Kejadian nyata (2026-09-20): role `admin` memegang 27 permission `site_only`,
 * sehingga daftar site menyusut ke satu site milik penggunanya — padahal
 * pemiliknya merasa tidak pernah membatasi apa pun.
 */

const AKSI_LENGKAP = [
  "read",
  "create",
  "update",
  "delete",
  "site_only",
  "department_only",
  "verify",
];

describe("pemisahan aksi kemampuan dan pembatasan", () => {
  it("tidak memasukkan aksi pembatasan ke pilihan massal", () => {
    const capability = getCapabilityActions(AKSI_LENGKAP);

    expect(capability).not.toContain("site_only");
    expect(capability).not.toContain("department_only");
  });

  it("mempertahankan seluruh aksi kemampuan, termasuk aksi khusus", () => {
    expect(getCapabilityActions(AKSI_LENGKAP)).toEqual([
      "read",
      "create",
      "update",
      "delete",
      "verify",
    ]);
  });

  it("mengumpulkan aksi pembatasan secara terpisah", () => {
    expect(getScopeActions(AKSI_LENGKAP)).toEqual([
      "site_only",
      "department_only",
    ]);
  });

  it("mengenali aksi pembatasan satu per satu", () => {
    expect(isScopeAction("site_only")).toBe(true);
    expect(isScopeAction("department_only")).toBe(true);
    expect(isScopeAction("read")).toBe(false);
  });

  it("aman untuk resource yang tidak punya aksi pembatasan", () => {
    expect(getCapabilityActions(["read", "update"])).toEqual([
      "read",
      "update",
    ]);
    expect(getScopeActions(["read", "update"])).toEqual([]);
  });
});
