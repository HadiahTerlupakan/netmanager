import { describe, expect, it, vi } from "vitest";
import { resolvePostLoginUrl } from "@/components/auth/LoginForm.utils";

/**
 * Login di `admin.<domain>` harus dilakukan dua kali baru berhasil.
 *
 * Penyebabnya: cabang subdomain admin memakai `router.push`, sementara dua
 * cabang lain memakai navigasi dokumen penuh. `/admin` dilindungi di server
 * component (`ensureAdminAccess`) yang mengalihkan ke halaman login bila sesi
 * kosong; `router.push` hanya mengambil RSC payload, yang bisa dilayani dari
 * Router Cache hasil prefetch sebelum login atau berangkat sebelum cookie sesi
 * terpasang. Pemanggil kini selalu melakukan navigasi dokumen penuh, dan
 * fungsi ini hanya memutuskan URL-nya.
 */
const buildAdminUrl = (path: string) => `https://admin.contoh.id${path}`;

describe("resolvePostLoginUrl", () => {
  it("memakai path apa adanya saat sudah berada di subdomain admin", () => {
    expect(
      resolvePostLoginUrl({
        targetPath: "/admin",
        subdomain: "admin",
        isLocalhost: false,
        buildAdminUrl,
      }),
    ).toBe("/admin");
  });

  it("memakai path apa adanya di localhost", () => {
    expect(
      resolvePostLoginUrl({
        targetPath: "/karyawan/dashboard",
        subdomain: null,
        isLocalhost: true,
        buildAdminUrl,
      }),
    ).toBe("/karyawan/dashboard");
  });

  // Dari domain utama, pengguna harus dipindahkan ke subdomain admin.
  it("membangun URL admin saat berada di luar subdomain admin", () => {
    expect(
      resolvePostLoginUrl({
        targetPath: "/admin",
        subdomain: null,
        isLocalhost: false,
        buildAdminUrl,
      }),
    ).toBe("https://admin.contoh.id/admin");
  });

  it("mempertahankan callback path saat berpindah ke subdomain admin", () => {
    const spy = vi.fn(buildAdminUrl);

    resolvePostLoginUrl({
      targetPath: "/admin/pelanggan/ppp",
      subdomain: "www",
      isLocalhost: false,
      buildAdminUrl: spy,
    });

    expect(spy).toHaveBeenCalledWith("/admin/pelanggan/ppp");
  });

  // Localhost diperiksa lebih dulu: di sana subdomain admin dilayani host yang
  // sama, jadi membangun URL absolut justru memindahkan pengguna keluar.
  it("mengutamakan localhost meski subdomain bukan admin", () => {
    const spy = vi.fn(buildAdminUrl);

    const url = resolvePostLoginUrl({
      targetPath: "/admin",
      subdomain: "www",
      isLocalhost: true,
      buildAdminUrl: spy,
    });

    expect(url).toBe("/admin");
    expect(spy).not.toHaveBeenCalled();
  });
});
