import { Prisma } from "@prisma/client";

export const ACTIVE_PACKAGE_STATUS = "AKTIF";

export const adminMutationSelect = {
  id: true,
  username: true,
  password: true,
  passwordHash: true,
  hargaPaketId: true,
  tipe: true,
  status: true,
  autoIsolir: true,
  siteId: true,
} satisfies Prisma.PelangganSelect;

export const adminDeleteSelect = {
  id: true,
  nama: true,
  username: true,
  siteId: true,
} satisfies Prisma.PelangganSelect;

export const adminMutationContextSelect = {
  id: true,
  username: true,
  status: true,
  siteId: true,
  nama: true,
} satisfies Prisma.PelangganSelect;

export const pelangganWithPackageInclude = {
  site: true,
  hargaPaket: {
    include: {
      profilePPP: true,
      bandwidth: true,
    },
  },
} satisfies Prisma.PelangganInclude;
