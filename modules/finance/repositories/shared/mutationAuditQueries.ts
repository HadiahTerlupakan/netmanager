import type { FinanceMutationDelegate } from "./financeMutationRepository";

/** Mengambil daftar mutasi beserta audit user. */
export async function findMutationManyWithAudit(options: {
  delegate: FinanceMutationDelegate;
  where: Record<string, unknown>;
}) {
  return options.delegate.findMany({
    where: options.where,
    orderBy: { tanggal: "desc" },
    include: {
      createdByuser: { select: { id: true, name: true, email: true } },
      updatedByuser: { select: { id: true, name: true, email: true } },
    },
  });
}

/** Mengambil satu mutasi beserta audit user. */
export function findMutationByIdWithAudit(options: {
  delegate: FinanceMutationDelegate;
  id: string;
  where: Record<string, unknown>;
}) {
  return options.delegate.findFirst({
    where: { id: options.id, ...options.where },
    include: {
      createdByuser: { select: { id: true, name: true, email: true } },
      updatedByuser: { select: { id: true, name: true, email: true } },
    },
  });
}

/** Mengambil id dan tanggal mutasi yang sudah difilter. */
export function findMutationIdsAndDates(options: {
  delegate: FinanceMutationDelegate;
  where: Record<string, unknown>;
}) {
  return options.delegate.findMany({
    where: options.where,
    select: { id: true, tanggal: true },
    orderBy: { tanggal: "desc" },
  });
}

/** Mengambil tanggal dan jumlah untuk kebutuhan grup per periode. */
export function findMutationPeriodSummaries(options: {
  delegate: FinanceMutationDelegate;
  where: Record<string, unknown>;
}) {
  return options.delegate.findMany({
    where: options.where,
    select: { tanggal: true, jumlah: true },
  });
}
