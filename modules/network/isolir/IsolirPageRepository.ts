import { prisma } from "@/modules/database";
import type { IsolirPage } from "@prisma/client";
import type { IsolirPageInput } from "./isolir-page.types";

export const IsolirPageRepository = {
  /** Filter tenantId selalu eksplisit agar benar di konteks request maupun sistem. */
  findByTenant(tenantId: string | null): Promise<IsolirPage | null> {
    return prisma.isolirPage.findFirst({ where: { tenantId } });
  },

  upsertForTenant(
    tenantId: string,
    data: Partial<IsolirPageInput>,
  ): Promise<IsolirPage> {
    return prisma.isolirPage.upsert({
      where: { tenantId },
      create: { ...data, tenantId },
      update: data,
    });
  },
};
