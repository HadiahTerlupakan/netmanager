import { deletePPPProfileInMikroTik } from "./mikrotik-ppp-profile";
import type {
  DeleteProfilePPPRecord,
  DeleteProfilePPPResult,
} from "./profile-ppp.types";

const DELETE_BLOCKED_PACKAGE_PREVIEW_LIMIT = 3;

export function buildDeleteBlockedMessage(
  profile: DeleteProfilePPPRecord,
): string {
  const paketNames = profile.hargaPaket
    .slice(0, DELETE_BLOCKED_PACKAGE_PREVIEW_LIMIT)
    .map((paket) => paket.name)
    .join(", ");
  const hiddenPackageCount =
    profile.hargaPaket.length > DELETE_BLOCKED_PACKAGE_PREVIEW_LIMIT
      ? ` dan ${profile.hargaPaket.length - DELETE_BLOCKED_PACKAGE_PREVIEW_LIMIT} lainnya`
      : "";

  return `Profile PPP "${profile.name}" tidak dapat dihapus karena masih digunakan oleh ${profile.hargaPaket.length} paket (${paketNames}${hiddenPackageCount}). Hapus atau ubah profile pada paket tersebut terlebih dahulu.`;
}

export async function cleanupProfileInMikroTik(
  profile: DeleteProfilePPPRecord,
): Promise<DeleteProfilePPPResult | null> {
  if (!profile.mikroTikRouterId) {
    return null;
  }

  try {
    const result = await deletePPPProfileInMikroTik(
      profile.mikroTikRouterId,
      profile.name,
      profile.remoteAddress,
    );

    if (result.success) {
      return null;
    }

    return {
      success: false,
      status: 502,
      error: result.error || "Gagal menghapus profile PPP di MikroTik",
    };
  } catch (error: unknown) {
    return {
      success: false,
      status: 502,
      error:
        error instanceof Error
          ? error.message
          : "Gagal menghapus profile PPP di MikroTik",
    };
  }
}
