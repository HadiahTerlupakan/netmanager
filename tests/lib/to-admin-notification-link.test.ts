import { describe, expect, it } from "vitest";
import { toAdminNotificationLink } from "@/lib/notifications/toAdminNotificationLink";

/** Notifikasi bertautan rute mobile tidak boleh berakhir 404 saat dibuka dari web. */
describe("toAdminNotificationLink", () => {
  it("rute pengesahan mobile diarahkan ke detail surat di admin", () => {
    expect(toAdminNotificationLink("/pengesahan/end-1")).toBe("/admin/pengesahan/end-1");
  });

  it("tautan web admin dikembalikan apa adanya", () => {
    expect(toAdminNotificationLink("/admin/legal/dokumen/doc-1")).toBe("/admin/legal/dokumen/doc-1");
    expect(toAdminNotificationLink("/admin/pengesahan/end-1")).toBe("/admin/pengesahan/end-1");
  });
});
