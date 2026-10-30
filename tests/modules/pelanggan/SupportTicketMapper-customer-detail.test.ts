import { describe, expect, it } from "vitest";

import type { SupportTicketEntity } from "@/modules/pelanggan/domain/entities/SupportTicketEntity";
import { SupportTicketMapper } from "@/modules/pelanggan/mappers/SupportTicketMapper";

const TIKET: SupportTicketEntity = {
  id: "tk1",
  ticketNumber: "TKT-1",
  subject: "Internet mati",
  description: "LOS merah",
  category: "TECHNICAL",
  priority: "HIGH",
  status: "IN_PROGRESS",
  createdAt: new Date("2026-10-02T01:00:00Z"),
  updatedAt: new Date("2026-10-02T02:00:00Z"),
  replies: [
    {
      id: "r1",
      message: "Foto lampu modem",
      isFromAdmin: false,
      createdAt: new Date("2026-10-02T01:10:00Z"),
      attachments: ["/uploads/tickets/tk1/modem.jpg"],
      user: null,
    },
    {
      id: "r2",
      message: "Teknisi menuju lokasi",
      isFromAdmin: true,
      createdAt: new Date("2026-10-02T01:30:00Z"),
      user: { id: "cs-1", name: "CS Rina" },
    },
  ],
};

// The portal page /dukungan/[id] and the mobile app read `ticket.replies`
// with attachment URLs; the detail used to send `messages` with every
// reply's attachments dropped, so the conversation never showed.
describe("SupportTicketMapper.toDetail", () => {
  it("sends the conversation as replies, oldest first", () => {
    const detail = SupportTicketMapper.toDetail(TIKET);

    expect(detail.replies.map((reply) => reply.id)).toEqual(["r1", "r2"]);
    expect(detail.replies[1]).toMatchObject({
      message: "Teknisi menuju lokasi",
      isFromAdmin: true,
      createdAt: "2026-10-02T01:30:00.000Z",
      sender: { id: "cs-1", name: "CS Rina", type: "admin" },
    });
  });

  it("keeps each reply's attachment URLs", () => {
    const detail = SupportTicketMapper.toDetail(TIKET);

    expect(detail.replies[0].attachments).toEqual([
      "/uploads/tickets/tk1/modem.jpg",
    ]);
    expect(detail.replies[1].attachments).toEqual([]);
  });
});
