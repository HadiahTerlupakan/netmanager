import type { Prisma } from "@prisma/client";

/** Returns true when error is Prisma unique constraint violation. */
export function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as Prisma.PrismaClientKnownRequestError).code === "P2002",
  );
}
