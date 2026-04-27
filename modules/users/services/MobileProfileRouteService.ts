import { getMitraMobileFeatures } from "@/lib/mobile-auth";
import { prisma, prismaMitra } from "@/modules/database";
import { getUserFeaturesWithCanvasing } from "@/modules/marketing";

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
  sites: Array<{ id: string; name: string }>;
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

/** Updates editable mobile profile fields for regular users. */
export async function updateMobileProfileForRoute(options: {
  user: MobileProfileUser;
  input: MobileProfileUpdateInput;
}) {
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
    sites: site ? [site] : [],
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
      isSales: true,
      departments: { select: { id: true, name: true } },
      sites: { select: { id: true, name: true } },
      role: {
        select: {
          id: true,
          name: true,
          permission: { select: { resource: true, action: true } },
        },
      },
    },
  });

  if (!profile) {
    return null;
  }

  return {
    ...profile,
    features: await getUserFeaturesWithCanvasing(profile.id),
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
