import { describe, expect, it } from "vitest";

import type { SupportTicketEntity } from "@/modules/pelanggan/domain/entities/SupportTicketEntity";
import { mapReplyEntities } from "@/modules/pelanggan/mappers/support-ticket-mapper.helpers";
import { SupportTicketMapper } from "@/modules/pelanggan/mappers/SupportTicketMapper";

const TIKET: SupportTicketEntity = {
  id: "tk1",
  ticketNumber: "TKT-1",
  subject: "Internet mati",
  description: "LOS merah",
  category: "TECHNICAL",
  priority: "HIGH",
  status: "OPEN",
  createdAt: new Date("2026-10-02T01:00:00Z"),
  updatedAt: new Date("2026-10-02T01:00:00Z"),
  pelanggan: { id: "p1", idPelanggan: "77001", nama: "Bu Sari", noTelp: "0812", email: null },
  user: { id: "cs-1", name: "CS Rina" },
  dilaporkanOleh: { id: "sales-1", name: "Ani" },
  replies: [],
  replyCount: 0,
};

describe("SupportTicketMapper.toAdminList", () => {
  // Regresi: daftar /admin/support dulu memakai mapper portal pelanggan yang
  // membuang `pelanggan`, padahal tabel admin membaca ticket.pelanggan.nama.
  it("membawa pelanggan, petugas, dan sales pelapor", () => {
    const [baris] = SupportTicketMapper.toAdminList([TIKET]);
    expect(baris.pelanggan).toEqual({ id: "p1", idPelanggan: "77001", nama: "Bu Sari", noTelp: "0812", email: null });
    expect(baris.assignedTo).toEqual({ id: "cs-1", name: "CS Rina" });
    expect(baris.dilaporkanOleh).toEqual({ id: "sales-1", name: "Ani" });
    expect(baris).toMatchObject({ ticketNumber: "TKT-1", description: "LOS merah", replyCount: 0 });
  });

  it("tiket dari portal pelanggan tidak punya pelapor", () => {
    const [baris] = SupportTicketMapper.toAdminList([{ ...TIKET, dilaporkanOleh: null, user: null }]);
    expect(baris.dilaporkanOleh).toBeNull();
    expect(baris.assignedTo).toBeNull();
  });
});

describe("mapReplyEntities", () => {
  // Regresi: lampiran dibuang mapper, sehingga foto keluhan & foto penyelesaian WO
  // tidak pernah tampil di percakapan /admin/support.
  it("membawa lampiran balasan (array maupun string JSON dari sinkron WO)", () => {
    const [foto, sinkronWo] = mapReplyEntities([
      { id: "r1", createdAt: new Date(), message: "Foto", isFromAdmin: false, attachments: ["/uploads/tickets/a.webp"] },
      { id: "r2", createdAt: new Date(), message: "Selesai", isFromAdmin: true, attachments: JSON.stringify(["/uploads/wo/b.webp"]) },
    ]);
    expect(foto.attachments).toEqual(["/uploads/tickets/a.webp"]);
    expect(sinkronWo.attachments).toEqual(["/uploads/wo/b.webp"]);
  });
});
