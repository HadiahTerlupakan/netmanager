import { describe, expect, it } from "vitest";

import type { RealtimeEnvelope } from "@/lib/realtime/contracts";

/**
 * Setiap envelope realtime wajib membawa `tenantId`.
 *
 * Aturan Firestore tidak bisa menanyakan Postgres siapa yang ditugaskan pada
 * sebuah work order, dan jalur dokumennya hanya memuat id work order. `tenantId`
 * pada dokumen adalah satu-satunya sumbu isolasi yang tersisa. Tanpa field itu
 * aturan hanya punya dua pilihan buruk: membuka untuk admin saja — sehingga
 * teknisi yang ditugaskan tidak pernah menerima event — atau membuka untuk semua
 * yang login, sehingga tenant lain ikut menyadap.
 *
 * Tipe ini sengaja menuntut `tenantId` (bukan opsional) supaya penerbit baru
 * tidak bisa lupa mengisinya tanpa gagal saat kompilasi.
 */

describe("envelope realtime membawa tenant", () => {
  it("tenantId adalah field wajib pada tipe envelope", () => {
    // Kompilasi berfungsi sebagai assertion: menghapus `tenantId` di sini
    // membuat typecheck gagal, dan itulah penjaga sebenarnya.
    const envelope: RealtimeEnvelope<{ pesan: string }> = {
      id: "evt-1",
      type: "workorder.update",
      scope: { kind: "workorder", id: "wo-1" },
      payload: { pesan: "status berubah" },
      createdAt: new Date().toISOString(),
      version: 1,
      tenantId: "tenant-1",
    };

    expect(envelope.tenantId).toBe("tenant-1");
  });

  // Worker latar (monitor RADIUS/MikroTik) berjalan tanpa konteks permintaan.
  // `null` di sana jawaban jujur, dan aturan Firestore menolaknya untuk
  // pembaca non-admin — itu perilaku yang diinginkan, bukan kebocoran.
  it("null diterima tipe, untuk event tanpa konteks tenant", () => {
    const envelope: RealtimeEnvelope = {
      id: "evt-2",
      type: "admin.location.update",
      scope: { kind: "admin", id: "monitor" },
      payload: {},
      createdAt: new Date().toISOString(),
      version: 1,
      tenantId: null,
    };

    expect(envelope.tenantId).toBeNull();
  });
});
