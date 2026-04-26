import { prisma } from "@/lib/prisma";
import { runWithRequestTenantContext } from "@/lib/tenant-context";

type RepairArgs = {
  tenantId: string | null;
  allTenants: boolean;
  startDate: Date;
  endDate: Date;
  dryRun: boolean;
  includeAutoCheckoutOnly: boolean;
};

type TenantRepository = {
  findMany(input: {
    select: { id: true };
    orderBy: { name: "asc" };
  }): Promise<{ id: string }[]>;
};

type TenantContextRunner = typeof runWithRequestTenantContext;

function getArgValue(args: string[], name: string): string | null {
  const prefix = `${name}=`;
  const arg = args.find((value) => value.startsWith(prefix));
  return arg?.slice(prefix.length) ?? null;
}

function parseRequiredDate(args: string[], name: string): Date {
  const value = getArgValue(args, name);
  if (!value) {
    throw new Error(`${name}=YYYY-MM-DD wajib diisi`);
  }

  const date = new Date(`${value}T00:00:00.000+07:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name} harus format YYYY-MM-DD`);
  }

  return date;
}

export function parseRepairArgs(args = process.argv.slice(2)): RepairArgs {
  const tenantId = getArgValue(args, "--tenant");
  const allTenants = args.includes("--all-tenants");

  if (!tenantId && !allTenants) {
    throw new Error("--tenant=<tenantId> atau --all-tenants wajib diisi");
  }

  if (tenantId && allTenants) {
    throw new Error("Pilih salah satu: --tenant=<tenantId> atau --all-tenants");
  }

  const startDate = parseRequiredDate(args, "--from");
  const endDate = parseRequiredDate(args, "--to");
  endDate.setHours(23, 59, 59, 999);

  return {
    tenantId,
    allTenants,
    startDate,
    endDate,
    dryRun: !args.includes("--apply"),
    includeAutoCheckoutOnly: args.includes("--include-auto-checkout-only"),
  };
}

export async function resolveRepairTenantIds(
  args: RepairArgs,
  tenantRepository: TenantRepository = prisma.tenant,
): Promise<string[]> {
  if (args.tenantId) {
    return [args.tenantId];
  }

  const tenants = await tenantRepository.findMany({
    select: { id: true },
    orderBy: { name: "asc" },
  });

  return tenants.map((tenant) => tenant.id);
}

export function runRepairTenantContext<T>(
  tenantId: string,
  callback: () => Promise<T>,
  runWithContext: TenantContextRunner = runWithRequestTenantContext,
): Promise<T> {
  return runWithContext({ tenantId, isSuperAdmin: false }, callback);
}

export type { RepairArgs };
