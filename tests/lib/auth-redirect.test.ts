import { describe, expect, it } from "vitest";
import { parseAllowedOrigins, resolveAuthRedirect } from "@/lib/auth/redirect";

/**
 * `NEXTAUTH_URL` di produksi adalah apex `https://radpro.id`, sedangkan portal
 * dibuka dari subdomain. Callback redirect bawaan NextAuth hanya mengizinkan
 * URL se-origin dengan apex, sehingga logout dari `admin.radpro.id` mendarat di
 * landing page — bukan di halaman login admin.
 */

const BASE_URL = "https://radpro.id";
const ALLOWED = [
  "https://radpro.id",
  "https://admin.radpro.id",
  "https://karyawan.radpro.id",
];

const resolve = (url: string) =>
  resolveAuthRedirect({ url, baseUrl: BASE_URL, allowedOrigins: ALLOWED });

describe("resolveAuthRedirect", () => {
  it("mempertahankan subdomain yang terdaftar", () => {
    expect(resolve("https://admin.radpro.id/admin/login")).toBe(
      "https://admin.radpro.id/admin/login",
    );
  });

  it("mengizinkan origin yang sama dengan base URL", () => {
    expect(resolve("https://radpro.id/admin/login")).toBe(
      "https://radpro.id/admin/login",
    );
  });

  // Daftar origin yang dibatasi mencegah callbackUrl dipakai sebagai open
  // redirect ke situs luar.
  it("menolak origin di luar daftar", () => {
    expect(resolve("https://penyerang.example.com/phish")).toBe(BASE_URL);
  });

  it("menolak subdomain mirip yang tidak terdaftar", () => {
    expect(resolve("https://admin.radpro.id.evil.com/")).toBe(BASE_URL);
  });

  it("menempelkan path relatif ke base URL", () => {
    expect(resolve("/admin/login")).toBe("https://radpro.id/admin/login");
  });

  it("mengembalikan base URL saat URL tidak valid", () => {
    expect(resolve("bukan-url")).toBe(BASE_URL);
  });
});

describe("parseAllowedOrigins", () => {
  it("memecah daftar dan membuang spasi", () => {
    expect(
      parseAllowedOrigins("https://radpro.id, https://admin.radpro.id"),
    ).toEqual(["https://radpro.id", "https://admin.radpro.id"]);
  });

  it("mengembalikan daftar kosong saat env tidak diset", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });
});
