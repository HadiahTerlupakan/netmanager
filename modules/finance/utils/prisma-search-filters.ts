/** Membuat filter contains case-insensitive Prisma untuk field string. */
export function createInsensitiveContainsFilter(value: string) {
  return { contains: value, mode: "insensitive" as const };
}
