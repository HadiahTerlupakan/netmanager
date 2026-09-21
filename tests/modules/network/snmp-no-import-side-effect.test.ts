import { describe, expect, it } from "vitest";

import { shutdownManager } from "@/lib/shutdown-manager";

/**
 * `snmp-optimized.ts` mendaftarkan handler shutdown saat MODUL DI-IMPORT, bukan
 * saat SNMP dipakai. Karena `modules/network/index.ts` mengekspornya
 * (`export * from "./services/snmp-optimized"`), setiap import dari
 * `@/modules/network` ikut menyeretnya.
 *
 * Dampaknya terlihat saat `next build`: sembilan worker pengumpul data halaman
 * masing-masing mendaftarkan listener proses, lalu mencatat
 * "[ShutdownManager] Process listeners registered" dan, saat worker ditutup,
 * "Received SIGINT, starting graceful shutdown..." — output build dibanjiri log
 * yang tidak ada hubungannya dengan build. Lebih dari sekadar berisik: logika
 * shutdown aplikasi (termasuk `process.exit(0)`) ikut berjalan di dalam worker
 * build.
 *
 * Ditemukan 2026-09-21, membesar setelah batas worker build dilepas dari 2 ke
 * default mesin (9).
 */

describe("snmp-optimized tidak berefek samping saat di-import", () => {
  it("tidak mendaftarkan handler shutdown hanya karena modulnya di-import", async () => {
    const sebelum = shutdownManager.getHandlerCount();

    await import("@/modules/network/services/snmp-optimized");

    expect(shutdownManager.getHandlerCount()).toBe(sebelum);
  });

  it("mengekspor pembersih koneksi untuk dipakai pemanggil", async () => {
    const modul = await import("@/modules/network/services/snmp-optimized");

    expect(typeof modul.cleanupSNMPConnections).toBe("function");
  });
});
