import {
  isPrismaRecordNotFoundError,
  isPrismaUniqueConstraintError,
  isPrismaForeignKeyError,
} from "@/lib/prisma-errors";

function createProfilePPPRouteError(status: number, error: string) {
  return { status, body: { error } };
}

export function mapProfilePPPRouteError(error: unknown) {
  if (isPrismaRecordNotFoundError(error)) {
    return createProfilePPPRouteError(404, "Profile PPP tidak ditemukan");
  }

  if (isPrismaUniqueConstraintError(error)) {
    return createProfilePPPRouteError(400, "Nama profile PPP sudah digunakan");
  }

  if (isPrismaForeignKeyError(error)) {
    return createProfilePPPRouteError(
      400,
      "Profile PPP tidak dapat dihapus karena masih digunakan oleh paket",
    );
  }

  return null;
}
