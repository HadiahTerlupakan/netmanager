import { prisma } from "@/modules/database";

const PROFILE_IMAGE_TAG = "user-profile";

/** Menyimpan URL foto profil mobile ke user yang sedang login. */
export async function saveMobileProfilePhoto(options: {
  userId: string;
  tenantId: string;
  imageUrl: string;
}) {
  const updatedUser = await updateProfilePhoto(options);
  return {
    id: updatedUser.id,
    name: updatedUser.name,
    image: updatedUser.image,
    tag: PROFILE_IMAGE_TAG,
  };
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
