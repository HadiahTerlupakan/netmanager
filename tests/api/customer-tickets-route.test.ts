import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../setup";
import { generatePelangganAccessToken } from "@/lib/jwt";
import { CUSTOMER_ACCESS_TOKEN_COOKIE } from "@/lib/customer-auth";

vi.mock("@/modules/events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/events")>()),
  TicketEventDispatcher: { onCreated: vi.fn().mockResolvedValue(undefined) },
}));

import {
  GET as listTickets,
  POST as createTicket,
} from "@/app/api/customer/tickets/route";
import { GET as getTicket } from "@/app/api/customer/tickets/[id]/route";
import { POST as replyTicket } from "@/app/api/customer/tickets/[id]/reply/route";
import { POST as closeTicket } from "@/app/api/customer/tickets/[id]/close/route";

const BASE_URL = "http://localhost/api/customer/tickets";
const OWNER_ID = "pelanggan-pemilik";
const OTHER_ID = "pelanggan-lain";
const TICKET_ID = "tiket-milik-pemilik";

function tokenFor(customerId: string) {
  return generatePelangganAccessToken({
    id: customerId,
    idPelanggan: `ID-${customerId}`,
    nama: `Nama ${customerId}`,
    username: customerId,
    status: "AKTIF",
  });
}

function buildRequest(
  path: string,
  options: { customerId?: string; method?: string; body?: unknown } = {},
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.customerId) {
    headers.set(
      "cookie",
      `${CUSTOMER_ACCESS_TOKEN_COOKIE}=${tokenFor(options.customerId)}`,
    );
  }
  return new NextRequest(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function ownerTicket(status = "OPEN"): Record<string, unknown> {
  return {
    id: TICKET_ID,
    ticketNumber: "TKT-20261027-0001",
    pelangganId: OWNER_ID,
    category: "TECHNICAL",
    priority: "MEDIUM",
    subject: "Internet mati",
    description: "Sejak pagi",
    status,
    assignedToId: null,
    resolvedAt: null,
    closedAt: null,
    rating: null,
    createdAt: new Date("2026-10-27T01:00:00Z"),
    updatedAt: new Date("2026-10-27T01:00:00Z"),
    tenantId: "tenant-1",
    replies: [],
    user: null,
    pelanggan: { id: OWNER_ID, idPelanggan: "ID-1", nama: "Pemilik" },
  };
}

type TicketWhere = { where: { id?: string; pelangganId?: string } };

/** Tiru filter Prisma: tiket hanya kembali bila id DAN pemiliknya cocok. */
function mockTicketStore(status = "OPEN") {
  const isOwned = ({ where }: TicketWhere) =>
    where.id === TICKET_ID && where.pelangganId === OWNER_ID;
  prismaMock.supportTickets.findFirst.mockImplementation(((args: TicketWhere) =>
    Promise.resolve(isOwned(args) ? ownerTicket(status) : null)) as never);
  prismaMock.supportTickets.findUnique.mockImplementation(((
    args: TicketWhere,
  ) =>
    Promise.resolve(
      args.where.id === TICKET_ID ? ownerTicket(status) : null,
    )) as never);
  prismaMock.supportTickets.updateMany.mockImplementation(((
    args: TicketWhere,
  ) => Promise.resolve({ count: isOwned(args) ? 1 : 0 })) as never);
  prismaMock.ticketReplies.create.mockImplementation(((args: {
    data: { message: string; attachments?: string[] };
  }) =>
    Promise.resolve({
      id: "balasan-1",
      ticketId: TICKET_ID,
      message: args.data.message,
      isFromAdmin: false,
      attachments: args.data.attachments ?? null,
      createdAt: new Date("2026-10-27T02:00:00Z"),
      user: null,
    })) as never);
}

describe("customer ticket routes", () => {
  beforeEach(() => {
    mockTicketStore();
  });

  it("menolak setiap rute tanpa sesi pelanggan dengan 401", async () => {
    const responses = await Promise.all([
      listTickets(buildRequest("")),
      createTicket(buildRequest("", { method: "POST", body: {} })),
      getTicket(buildRequest(`/${TICKET_ID}`), routeParams(TICKET_ID)),
      replyTicket(
        buildRequest(`/${TICKET_ID}/reply`, {
          method: "POST",
          body: { message: "x" },
        }),
        routeParams(TICKET_ID),
      ),
      closeTicket(
        buildRequest(`/${TICKET_ID}/close`, { method: "POST", body: {} }),
        routeParams(TICKET_ID),
      ),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401, 401, 401,
    ]);
    expect(prismaMock.supportTickets.findFirst).not.toHaveBeenCalled();
  });

  it("mendaftar tiket hanya milik pelanggan dari sesi", async () => {
    prismaMock.supportTickets.findMany.mockResolvedValue([
      ownerTicket(),
    ] as never);
    prismaMock.supportTickets.count.mockResolvedValue(1 as never);

    const response = await listTickets(
      buildRequest("?limit=1", { customerId: OWNER_ID }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tickets).toHaveLength(1);
    expect(body.tickets[0].ticketNumber).toBe("TKT-20261027-0001");
    expect(body.pagination.total).toBe(1);
    const findManyArgs = prismaMock.supportTickets.findMany.mock
      .calls[0]![0] as {
      where: { pelangganId: string };
      take: number;
    };
    expect(findManyArgs.where.pelangganId).toBe(OWNER_ID);
    expect(findManyArgs.take).toBe(1);
  });

  it("membuat tiket atas nama pelanggan dari sesi, bukan dari body", async () => {
    prismaMock.supportTickets.count.mockResolvedValue(0 as never);
    prismaMock.supportTickets.create.mockImplementation(((args: {
      data: Record<string, unknown>;
    }) => Promise.resolve({ ...ownerTicket(), ...args.data })) as never);

    const response = await createTicket(
      buildRequest("", {
        customerId: OWNER_ID,
        method: "POST",
        body: {
          category: "TECHNICAL",
          subject: "Internet mati",
          description: "Sejak pagi",
          pelangganId: OTHER_ID,
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.ticket.ticketNumber).toMatch(/^TKT-/);
    const createArgs = prismaMock.supportTickets.create.mock.calls[0]![0] as {
      data: { pelangganId: string };
    };
    expect(createArgs.data.pelangganId).toBe(OWNER_ID);
  });

  it("menolak tiket baru dengan kategori tidak valid", async () => {
    const response = await createTicket(
      buildRequest("", {
        customerId: OWNER_ID,
        method: "POST",
        body: { category: "BUKAN", subject: "a", description: "b" },
      }),
    );

    expect(response.status).toBe(400);
    expect(prismaMock.supportTickets.create).not.toHaveBeenCalled();
  });

  it("menampilkan detail tiket milik sendiri", async () => {
    const response = await getTicket(
      buildRequest(`/${TICKET_ID}`, { customerId: OWNER_ID }),
      routeParams(TICKET_ID),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ticket.id).toBe(TICKET_ID);
  });

  it("mengembalikan 404 untuk tiket pelanggan lain di detail, balas, dan tutup", async () => {
    const [detail, reply, close] = await Promise.all([
      getTicket(
        buildRequest(`/${TICKET_ID}`, { customerId: OTHER_ID }),
        routeParams(TICKET_ID),
      ),
      replyTicket(
        buildRequest(`/${TICKET_ID}/reply`, {
          customerId: OTHER_ID,
          method: "POST",
          body: { message: "menyusup" },
        }),
        routeParams(TICKET_ID),
      ),
      closeTicket(
        buildRequest(`/${TICKET_ID}/close`, {
          customerId: OTHER_ID,
          method: "POST",
          body: { rating: 1 },
        }),
        routeParams(TICKET_ID),
      ),
    ]);

    expect([detail.status, reply.status, close.status]).toEqual([
      404, 404, 404,
    ]);
    expect(prismaMock.ticketReplies.create).not.toHaveBeenCalled();
    expect(prismaMock.supportTickets.updateMany).not.toHaveBeenCalled();
  });

  it("menyimpan balasan pelanggan beserta lampirannya", async () => {
    const response = await replyTicket(
      buildRequest(`/${TICKET_ID}/reply`, {
        customerId: OWNER_ID,
        method: "POST",
        body: {
          message: "Masih mati",
          attachments: ["/uploads/tickets/foto.webp"],
        },
      }),
      routeParams(TICKET_ID),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reply).toMatchObject({
      id: "balasan-1",
      message: "Masih mati",
      isFromAdmin: false,
      attachments: ["/uploads/tickets/foto.webp"],
    });
    const replyArgs = prismaMock.ticketReplies.create.mock.calls[0]![0] as {
      data: { pelangganId: string; ticketId: string };
    };
    expect(replyArgs.data).toMatchObject({
      pelangganId: OWNER_ID,
      ticketId: TICKET_ID,
    });
  });

  it.each([
    ["skema javascript:", "javascript:alert(1)"],
    ["domain luar", "https://evil.example/uploads/tickets/foto.webp"],
    ["keluar folder tiket", "/uploads/tickets/../logos/x.webp"],
    ["folder lain", "/uploads/logos/x.webp"],
  ])("menolak lampiran %s", async (_label, attachment) => {
    const response = await replyTicket(
      buildRequest(`/${TICKET_ID}/reply`, {
        customerId: OWNER_ID,
        method: "POST",
        body: { message: "Masih mati", attachments: [attachment] },
      }),
      routeParams(TICKET_ID),
    );

    expect(response.status).toBe(400);
    expect(prismaMock.ticketReplies.create).not.toHaveBeenCalled();
  });

  it("menerima lampiran di folder tiket milik tenant", async () => {
    const response = await replyTicket(
      buildRequest(`/${TICKET_ID}/reply`, {
        customerId: OWNER_ID,
        method: "POST",
        body: {
          message: "Masih mati",
          attachments: [
            "/uploads/tenants/tenant-1/tickets/1700000000-foto.webp",
          ],
        },
      }),
      routeParams(TICKET_ID),
    );

    expect(response.status).toBe(200);
  });

  it("menolak balasan ke tiket yang sudah ditutup", async () => {
    mockTicketStore("CLOSED");

    const response = await replyTicket(
      buildRequest(`/${TICKET_ID}/reply`, {
        customerId: OWNER_ID,
        method: "POST",
        body: { message: "halo" },
      }),
      routeParams(TICKET_ID),
    );

    expect(response.status).toBe(400);
    expect(prismaMock.ticketReplies.create).not.toHaveBeenCalled();
  });

  it("menutup tiket milik sendiri dengan rating", async () => {
    const response = await closeTicket(
      buildRequest(`/${TICKET_ID}/close`, {
        customerId: OWNER_ID,
        method: "POST",
        body: { rating: 5, feedback: "Cepat" },
      }),
      routeParams(TICKET_ID),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    const updateArgs = prismaMock.supportTickets.updateMany.mock
      .calls[0]![0] as {
      where: { id: string; pelangganId: string };
      data: { status: string; rating: number };
    };
    expect(updateArgs.where).toEqual({ id: TICKET_ID, pelangganId: OWNER_ID });
    expect(updateArgs.data).toMatchObject({ status: "CLOSED", rating: 5 });
  });
});
