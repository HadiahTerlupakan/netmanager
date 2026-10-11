import { getMitraMobileFeatures } from "@/lib/mobile-auth";
import { prisma, prismaMitra } from "@/modules/database";
import {
  canCashoutCanvasingBonus,
  extractMobileFeaturesFromPermissions,
  hasCanvasingCashoutPermission,
} from "@/modules/marketing";
import { jenisLingkupDariIzin } from "@/modules/roles";
import {
  daftarIzinRole,
  isSalesPengguna,
  personaPengguna,
} from "./peran-sales-pengguna";

const PERAN_MITRA = "MITRA";

type MobileProfileUser = {
  id?: string;
  role?: string;
  tenantId?: string | null;
};

type MobileProfileUpdateInput = {
  name?: string;
  phone?: string;
};

type MitraMobileProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
  nik: string | null;
  fotoDiri: string | null;
  createdAt: string;
  mitraType: string;
  requiresFaceVerification: boolean;
  workingHourMode: null;
  startWorkTime: null;
  endWorkTime: null;
  workDays: null;
  canvasingTarget: null;
  isSales: boolean;
  departments: null;
  /**
   * Satu objek, bukan array — bentuknya harus sama dengan profil karyawan
   * (`User.sites` adalah relasi tunggal). Aplikasi membaca `sites.name`; array
   * di sini membuat site mitra selalu terbaca "Belum diatur".
   */
  sites: { id: string; name: string } | null;
  role: { id: string; name: string };
  features: string[];
  isOnLeave: boolean;
};

/** Returns mobile profile payload for user and mitra sessions. */
export async function getMobileProfileForRoute(user: MobileProfileUser) {
  if (user.role === "MITRA") {
    return getMitraProfile(user);
  }

  return getRegularUserProfile(user);
}

/** Updates editable mobile profile fields for user and mitra sessions. */
export async function updateMobileProfileForRoute(options: {
  user: MobileProfileUser;
  input: MobileProfileUpdateInput;
}) {
  if (options.user.role === PERAN_MITRA) {
    return updateMitraProfile(options);
  }

  return prisma.user.update({
    where: {
      id: options.user.id as string,
      tenantId: options.user.tenantId,
    },
    data: buildProfileUpdateData(options.input),
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
    },
  });
}

export function hasMobileProfileUpdate(input: MobileProfileUpdateInput) {
  return input.name !== undefined || input.phone !== undefined;
}

/**
 * Mitra tersimpan di database mitra, bukan tabel `User`. Tanpa cabang ini
 * `prisma.user.update` tidak menemukan barisnya dan PATCH profil mitra
 * berakhir 500.
 */
async function updateMitraProfile(options: {
  user: MobileProfileUser;
  input: MobileProfileUpdateInput;
}) {
  const mitra = await prismaMitra.mitra.findFirst({
    where: {
      id: options.user.id as string,
      tenantId: options.user.tenantId,
    },
    select: { id: true },
  });

  if (!mitra) {
    throw new Error("Mitra tidak ditemukan");
  }

  const updated = await prismaMitra.mitra.update({
    where: { id: mitra.id },
    data: buildProfileUpdateData(options.input),
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      fotoDiri: true,
    },
  });

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    image: updated.fotoDiri,
  };
}

async function getMitraProfile(
  user: MobileProfileUser,
): Promise<MitraMobileProfile | null> {
  const mitra = await prismaMitra.mitra.findFirst({
    where: {
      id: user.id as string,
      tenantId: user.tenantId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      mitraType: true,
      nik: true,
      fotoDiri: true,
      createdAt: true,
      siteId: true,
      requiresFaceVerification: true,
    },
  });

  if (!mitra) {
    return null;
  }

  const site = mitra.siteId
    ? await prisma.sites.findFirst({
        where: {
          id: mitra.siteId,
          tenantId: user.tenantId,
        },
        select: { id: true, name: true },
      })
    : null;

  return {
    id: mitra.id,
    name: mitra.name,
    email: mitra.email,
    phone: mitra.phone,
    image: mitra.fotoDiri,
    nik: mitra.nik,
    fotoDiri: mitra.fotoDiri,
    createdAt: mitra.createdAt.toISOString(),
    mitraType: mitra.mitraType,
    requiresFaceVerification: mitra.requiresFaceVerification,
    workingHourMode: null,
    startWorkTime: null,
    endWorkTime: null,
    workDays: null,
    canvasingTarget: null,
    isSales: mitra.mitraType === "MITRA_SALES",
    departments: null,
    sites: site,
    role: { id: "mitra", name: "MITRA" },
    features: getMitraMobileFeatures(mitra.mitraType),
    isOnLeave: false,
  };
}

async function getRegularUserProfile(user: MobileProfileUser) {
  const profile = await prisma.user.findFirst({
    where: {
      id: user.id as string,
      tenantId: user.tenantId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      workingHourMode: true,
      startWorkTime: true,
      endWorkTime: true,
      workDays: true,
      canvasingTarget: true,
      departments: { select: { id: true, name: true } },
      sites: { select: { id: true, name: true } },
      role: {
        select: {
          id: true,
          name: true,
          isSuperAdmin: true,
          persona: true,
          permission: { select: { resource: true, action: true } },
        },
      },
    },
  });

  if (!profile) {
    return null;
  }

  const permissions = profile.role?.permission ?? [];
  const isSales = isSalesPengguna(profile);
  return {
    ...profile,
    isSales,
    persona: personaPengguna(profile),
    features: extractMobileFeaturesFromPermissions(permissions),
    canCashoutCanvasing: canCashoutCanvasingBonus({
      isSales,
      // Super admin boleh mencairkan, sama dengan route cashout (`hasCashoutPermission`).
      hasCashoutPermission:
        Boolean(profile.role?.isSuperAdmin) ||
        hasCanvasingCashoutPermission(permissions),
    }),
    // TIM/SEMUA = boleh menugaskan & memantau rencana orang lain (kepala sales/admin).
    lingkupRencana: jenisLingkupDariIzin(daftarIzinRole(profile.role)),
    isOnLeave: await isUserOnLeave(user),
  };
}

async function isUserOnLeave(user: MobileProfileUser) {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const activeLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId: user.id as string,
      status: "APPROVED",
      tenantId: user.tenantId,
      startDate: { lte: now },
      endDate: { gte: startOfToday },
    },
  });

  return Boolean(activeLeave);
}

function buildProfileUpdateData(input: MobileProfileUpdateInput) {
  const updateData: MobileProfileUpdateInput = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.phone !== undefined) updateData.phone = input.phone;
  return updateData;
}
