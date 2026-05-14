import { toStartOfDay } from "@/lib/utils/server-datetime";
import type {
  CanvasingCompletionSummaryEntity,
  CanvasingEntity,
} from "../domain/entities/CanvasingEntity";
import type { ICanvasingRepository } from "../domain/ports/ICanvasingRepository";
import { prismaAuth } from "@/modules/database";

export const NORMAL_PRIORITY = "NORMAL" as const;
export const INSTALLATION_TYPE = "INSTALLATION" as const;
export const PENDING_STATUS = "PENDING" as const;
export const APPROVED_STATUS = "APPROVED" as const;
export const REJECTED_STATUS = "REJECTED" as const;

/**
 * Get Technical department ID based on site's tenantId.
 * INSTALLATION work orders should be routed to Technical department.
 *
 * Uses prismaAuth to bypass tenant isolation since we need to query
 * departments across tenants based on the site's tenantId.
 */
async function getTechnicalDepartmentId(
  siteId: string | undefined,
): Promise<string | undefined> {
  if (!siteId) {
    return undefined;
  }

  const site = await prismaAuth.sites.findUnique({
    where: { id: siteId },
    select: { tenantId: true },
  });

  if (!site?.tenantId) {
    return undefined;
  }

  const technicalDept = await prismaAuth.departments.findFirst({
    where: {
      name: "Technical",
      tenantId: site.tenantId,
    },
    select: { id: true },
  });

  return technicalDept?.id;
}

export function buildCompletionSummaryRange(now: Date): Pick<
  CanvasingCompletionSummaryEntity,
  never
> & {
  today: Date;
  tomorrow: Date;
  weekStart: Date;
  monthStart: Date;
} {
  const today = toStartOfDay(now);
  const tomorrow = addDays(today, 1);

  return {
    today,
    tomorrow,
    weekStart: getWeekStart(today),
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
  };
}

export async function requireCanvasing(
  repository: ICanvasingRepository,
  id: string,
): Promise<CanvasingEntity> {
  const request = await repository.findById(id);
  if (request) {
    return request;
  }

  throw new Error("Request tidak ditemukan");
}

export async function requirePendingCanvasingForApproval(
  repository: ICanvasingRepository,
  id: string,
): Promise<CanvasingEntity> {
  const request = await repository.findByIdWithSales(id);
  if (!request) {
    throw new Error("Request tidak ditemukan");
  }

  ensurePendingCanvasingStatus(request.status, "disetujui");
  return request;
}

export function ensurePendingCanvasingStatus(
  status: string,
  action: string,
): void {
  if (status === PENDING_STATUS) {
    return;
  }

  throw new Error(`Hanya request PENDING yang bisa ${action}`);
}

export async function buildWorkOrderCreateInput(
  request: CanvasingEntity,
  approverId: string,
  workOrderNumber: string,
) {
  const siteId = request.user?.siteId ?? request.mitra?.siteId ?? undefined;
  const departmentId = await getTechnicalDepartmentId(siteId);

  return {
    workOrderNumber,
    title: `Instalasi Baru - ${request.nama}`,
    description: buildWorkOrderDescription(request),
    priority: NORMAL_PRIORITY,
    type: INSTALLATION_TYPE,
    ...(siteId ? { siteId } : {}),
    ...(departmentId ? { departmentId } : {}),
    contactName: request.nama,
    contactPhone: request.noTelpon,
    locationAddress: request.alamat,
    ...(request.latitude ? { locationLat: request.latitude } : {}),
    ...(request.longitude ? { locationLng: request.longitude } : {}),
    createdById: approverId,
  };
}

/**
 * Build installation tasks untuk work order dari canvasing request.
 * Note: 33 baris - sudah optimal dengan conditional logic untuk task generation.
 * Memecah lebih lanjut akan memisahkan business rule yang harus kohesif.
 */
export function buildInstallationTasks(request: CanvasingEntity) {
  const baseTasks = [
    {
      title: `Kabel ${request.kabel} meter`,
      description: "Tarik kabel dari ODP ke rumah pelanggan",
      order: 1,
    },
    {
      title: "Pasang Modem/Router",
      description: "Setting dan pasang perangkat CPE",
      order: request.sn ? 3 : 2,
    },
    {
      title: "Test Koneksi",
      description: "Verifikasi koneksi internet berjalan dengan baik",
      order: request.sn ? 4 : 3,
    },
  ];

  if (!request.sn) {
    return baseTasks;
  }

  return [
    baseTasks[0],
    {
      title: `SN ONT: ${request.sn}`,
      description: "Pasang ONT dengan SN yang sudah ditentukan",
      order: 2,
    },
    ...baseTasks.slice(1),
  ];
}

function buildWorkOrderDescription(request: CanvasingEntity): string {
  return [
    "Canvasing Approved",
    `Pelanggan: ${request.nama}`,
    `Paket: ${request.paket}`,
    request.odp ? `ODP: ${request.odp}` : null,
  ]
    .filter(Boolean)
    .join(". ");
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getWeekStart(today: Date): Date {
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  return weekStart;
}
