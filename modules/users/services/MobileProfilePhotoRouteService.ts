import { prisma, prismaMitra } from "@/modules/database";

const PROFILE_IMAGE_TAG = "user-profile";
const PERAN_MITRA = "MITRA";

/** Menyimpan URL foto profil mobile ke akun yang sedang login. */
export async function saveMobileProfilePhoto(options: {
  userId: string;
  tenantId: string;
  imageUrl: string;
  role?: string | null;
}) {
  const updatedUser =
    options.role === PERAN_MITRA
      ? await updateMitraProfilePhoto(options)
      : await updateProfilePhoto(options);
  return {
    id: updatedUser.id,
    name: updatedUser.name,
    image: updatedUser.image,
    tag: PROFILE_IMAGE_TAG,
  };
}

/**
 * Mitra menyimpan fotonya di kolom `fotoDiri` pada database mitra. Lewat
 * `prisma.user` barisnya tidak pernah ditemukan dan unggahan berakhir 500.
 */
async function updateMitraProfilePhoto(options: {
  userId: string;
  tenantId: string;
  imageUrl: string;
}) {
  const mitra = await prismaMitra.mitra.findFirst({
    where: { id: options.userId, tenantId: options.tenantId },
    select: { id: true },
  });

  if (!mitra) {
    throw new Error("Mitra tidak ditemukan");
  }

  const updated = await prismaMitra.mitra.update({
    where: { id: mitra.id },
    data: { fotoDiri: options.imageUrl },
    select: { id: true, name: true, fotoDiri: true },
  });

  return { id: updated.id, name: updated.name, image: updated.fotoDiri };
}

async function updateProfilePhoto(options: {
  userId: string;
  tenantId: string;
  imageUrl: string;
}) {
  const user = await prisma.user.findFirst({
    where: { id: options.userId, tenantId: options.tenantId },
    select: { id: true },
  });
  if (!user) {
    throw new Error("User tidak ditemukan");
  }

  return prisma.user.update({
    where: { id: options.userId },
    data: { image: options.imageUrl },
    select: { id: true, name: true, image: true },
  });
}
