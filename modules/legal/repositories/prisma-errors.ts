import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";

const PRISMA_UNIQUE_VIOLATION = "P2002";

/** Galat Prisma karena melanggar indeks unik. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === PRISMA_UNIQUE_VIOLATION
  );
}

/** Nama unik per tenant; bentrok diterjemahkan ke 409, bukan 500. */
export async function withDuplicateNameGuard<T>(
  message: string,
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(message, 409, "DUPLICATE");
    throw error;
  }
}
