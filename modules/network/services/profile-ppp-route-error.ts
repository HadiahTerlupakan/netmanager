import {
  isPrismaRecordNotFoundError,
  isPrismaUniqueConstraintError,
  isPrismaForeignKeyError,
} from "@/lib/prisma-errors";

export function mapProfilePPPRouteError(error: unknown) {
  if (isPrismaRecordNotFoundError(error)) {
    return { status: 404, body: { error: "Profile PPP tidak ditemukan" } };
  }

  if (isPrismaUniqueConstraintError(error)) {
    return { status: 400, body: { error: "Nama profile PPP sudah digunakan" } };
  }

  if (isPrismaForeignKeyError(error)) {
    return {
      status: 400,
      body: {
        error:
          "Profile PPP tidak dapat dihapus karena masih digunakan oleh paket",
      },
    };
  }

  return null;
}
