import { prisma } from "@/lib/prisma";
import { SupportTicketMapper } from "../mappers/SupportTicketMapper";

/** Get admin ticket detail by id. */
export async function findByIdAdmin(id: string) {
  const ticket = await prisma.supportTickets.findUnique({
    where: { id },
    include: buildAdminTicketDetailInclude(),
  });
  return ticket ? SupportTicketMapper.toDomain(ticket) : null;
}

/** Get basic ticket detail by id. */
export async function findByIdBasic(id: string) {
  const ticket = await prisma.supportTickets.findUnique({
    where: { id },
    include: { pelanggan: { select: { siteId: true, nama: true } } },
  });
  return ticket ? SupportTicketMapper.toDomain(ticket) : null;
}

/** Get customer-owned ticket detail by id. */
export async function findByIdForCustomer(id: string, pelangganId: string) {
  const ticket = await prisma.supportTickets.findFirst({
    where: { id, pelangganId },
    include: buildCustomerTicketDetailInclude(),
  });
  return ticket ? SupportTicketMapper.toDomain(ticket) : null;
}

function buildAdminTicketDetailInclude() {
  return {
    pelanggan: { select: buildAdminTicketCustomerSelect() },
    user: { select: { id: true, name: true, email: true } },
    replies: buildReplyInclude(),
  };
}

function buildAdminTicketCustomerSelect() {
  return {
    id: true,
    idPelanggan: true,
    nama: true,
    username: true,
    email: true,
    noTelp: true,
    alamat: true,
    status: true,
    siteId: true,
    hargaPaket: { select: { name: true } },
  };
}

function buildReplyInclude() {
  return {
    orderBy: { createdAt: "asc" as const },
    include: { user: { select: { id: true, name: true, image: true } } },
  };
}

function buildCustomerTicketDetailInclude() {
  return {
    replies: {
      orderBy: { createdAt: "asc" as const },
      include: { user: { select: { id: true, name: true, image: true } } },
    },
    user: { select: { id: true, name: true, image: true } },
    pelanggan: {
      select: {
        id: true,
        idPelanggan: true,
        nama: true,
        email: true,
        noTelp: true,
      },
    },
  };
}
