import { Prisma } from "@prisma/client";

export function mapProfilePPPRouteError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  if (error.code === "P2025") {
    return { status: 404, body: { error: "Profile PPP tidak ditemukan" } };
  }

  if (error.code === "P2002") {
    return { status: 400, body: { error: "Nama profile PPP sudah digunakan" } };
  }

  if (error.code === "P2003") {
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
