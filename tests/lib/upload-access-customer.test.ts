import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMobileToken = vi.fn();
const getToken = vi.fn();

// Ticket replies as the database holds them. The fake findMany narrows the
// way Postgres does (owner, sender, loose containment); exactness is the
// code's job.
const balasan = vi.hoisted(() => ({
  rows: [] as Array<{
    pelangganId: string;
    isFromAdmin: boolean;
    attachments: unknown;
  }>,
}));

vi.mock("@/lib/mobile-auth", () => ({
  verifyMobileToken: (...args: unknown[]) => verifyMobileToken(...args),
}));
vi.mock("next-auth/jwt", () => ({
  getToken: (...args: unknown[]) => getToken(...args),
}));
vi.mock("@/lib/jwt", () => ({
  verifyPelangganAccessToken: (token: string) =>
    ({
      "token-budi": { id: "p-budi", tenantId: "tenant-a", status: "AKTIF" },
      "token-putus": {
        id: "p-putus",
        tenantId: "tenant-a",
        status: "DISMANTLE",
      },
    })[token] ?? null,
}));
vi.mock("@/lib/prisma", () => ({
  prismaAuth: {
    ticketReplies: {
      findMany: async ({
        where,
      }: {
        where: {
          isFromAdmin?: boolean;
          supportTickets: { pelangganId: string };
          OR: [
            { attachments: { array_contains: string[] } },
            { attachments: { string_contains: string } },
          ];
        };
      }) => {
        const [elemen] = where.OR[0].attachments.array_contains;
        const potongan = where.OR[1].attachments.string_contains;
        return balasan.rows
          .filter(
            (row) =>
              row.pelangganId === where.supportTickets.pelangganId &&
              (where.isFromAdmin === undefined ||
                row.isFromAdmin === where.isFromAdmin) &&
              (Array.isArray(row.attachments)
                ? row.attachments.includes(elemen)
                : String(row.attachments).includes(potongan)),
          )
          .map((row) => ({ attachments: row.attachments }));
      },
    },
  },
}));

import { punyaAksesBacaUpload } from "@/lib/upload/upload-access";

/**
 * Customers sign in with their own token (cookie `customer-token` on the
 * portal, Bearer in the app), which /uploads/ used to ignore entirely. They
 * may open what they uploaded themselves (their own folder) and the files
 * staff attached to their tickets, wherever those are stored. A path a
 * customer merely wrote into their own reply proves nothing.
 */

const FOTO_BUDI = "/uploads/tickets/p-p-budi/9d1c.webp";
const FOTO_BUDI_TENANT = "/uploads/tenants/tenant-a/tickets/p-p-budi/9d1c.webp";
const FOTO_WO_UNTUK_BUDI =
  "/uploads/tenants/tenant-a/work-orders/selesai/7a2e.webp";
const FOTO_STAF_UNTUK_BUDI = "/uploads/tickets/staf-41.webp";
const FOTO_ORANG_LAIN = "/uploads/tickets/p-p-sari/5b3f.webp";
const KTP_TENANT_A = "/uploads/tenants/tenant-a/marketing/canvasing/ktp.webp";

const bearer = (token: string) => ({
  headers: { authorization: `Bearer ${token}` },
});
const cookie = (token: string) => ({
  headers: { cookie: `customer-token=${token}` },
});

beforeEach(() => {
  verifyMobileToken.mockReset();
  verifyMobileToken.mockResolvedValue(null);
  getToken.mockReset();
  getToken.mockResolvedValue(null);
  balasan.rows = [
    {
      pelangganId: "p-budi",
      isFromAdmin: true,
      attachments: [FOTO_STAF_UNTUK_BUDI],
    },
    // Work-order sync stores the array as a JSON string.
    {
      pelangganId: "p-budi",
      isFromAdmin: true,
      attachments: JSON.stringify([FOTO_WO_UNTUK_BUDI]),
    },
    // Budi wrote someone else's path into his own reply.
    {
      pelangganId: "p-budi",
      isFromAdmin: false,
      attachments: [FOTO_ORANG_LAIN],
    },
  ];
});

describe("customer readers of /uploads/", () => {
  it.each([
    ["Bearer from the app", bearer("token-budi")],
    ["portal cookie", cookie("token-budi")],
  ])("open their own uploads with the %s", async (_label, req) => {
    await expect(punyaAksesBacaUpload(req, FOTO_BUDI)).resolves.toBe(true);
    await expect(punyaAksesBacaUpload(req, FOTO_BUDI_TENANT)).resolves.toBe(
      true,
    );
  });

  it("open files staff attached to their tickets", async () => {
    await expect(
      punyaAksesBacaUpload(bearer("token-budi"), FOTO_STAF_UNTUK_BUDI),
    ).resolves.toBe(true);
    await expect(
      punyaAksesBacaUpload(bearer("token-budi"), FOTO_WO_UNTUK_BUDI),
    ).resolves.toBe(true);
  });

  it("cannot open another customer's upload by citing it in their own reply", async () => {
    await expect(
      punyaAksesBacaUpload(bearer("token-budi"), FOTO_ORANG_LAIN),
    ).resolves.toBe(false);
  });

  it("does not match a staff attachment by prefix", async () => {
    await expect(
      punyaAksesBacaUpload(bearer("token-budi"), "/uploads/tickets/staf-4"),
    ).resolves.toBe(false);
    await expect(
      punyaAksesBacaUpload(
        bearer("token-budi"),
        "/uploads/tenants/tenant-a/work-orders/selesai/7a2e",
      ),
    ).resolves.toBe(false);
  });

  it("cannot open an upload unrelated to their tickets", async () => {
    await expect(
      punyaAksesBacaUpload(cookie("token-budi"), KTP_TENANT_A),
    ).resolves.toBe(false);
  });

  it("is refused once the account is dismantled", async () => {
    await expect(
      punyaAksesBacaUpload(
        bearer("token-putus"),
        "/uploads/tickets/p-p-putus/a.webp",
      ),
    ).resolves.toBe(false);
  });

  it("rejects an invalid customer token", async () => {
    await expect(
      punyaAksesBacaUpload(cookie("palsu"), FOTO_BUDI),
    ).resolves.toBe(false);
  });

  it("keeps staff on the staff rules", async () => {
    getToken.mockResolvedValue({ tenantId: "tenant-a", isSuperAdmin: false });

    await expect(
      punyaAksesBacaUpload({ headers: {} }, KTP_TENANT_A),
    ).resolves.toBe(true);
  });
});
