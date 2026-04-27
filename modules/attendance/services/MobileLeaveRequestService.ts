import { NextResponse } from "next/server";
import { LeaveStatus, LeaveType, Prisma } from "@prisma/client";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { LeaveBalanceRepository } from "../repositories/LeaveBalanceRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { calculateWorkingDays } from "../utils/calculateWorkingDays";
import { validateTukarLiburRules } from "./LeaveService";
import { convertAndSaveBase64 } from "@/lib/utils/image-upload";
import { createNotification } from "@/modules/notification/services/NotificationService";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { prisma } from "@/modules/database";

export interface MobileLeaveRequestInput {
  userId: string;
  tenantId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  photos?: string[];
  replacementDate?: string;
}

type RequesterContext = {
  workingHourMode: string | null;
  workDays: string | null;
  name: string | null;
  siteId: string | null;
};

export class MobileLeaveRequestService {
  private readonly leaveRepository: LeaveRepository;
  private readonly leaveBalanceRepository: LeaveBalanceRepository;
  private readonly holidayRepository: HolidayRepository;

  constructor() {
    this.leaveRepository = new LeaveRepository();
    this.leaveBalanceRepository = new LeaveBalanceRepository();
    this.holidayRepository = new HolidayRepository();
  }

  /** Load requester work schedule and site context. */
  private findRequesterContext(userId: string, tenantId: string) {
    return prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        workingHourMode: true,
        workDays: true,
        name: true,
        siteId: true,
      },
    }) as Promise<RequesterContext | null>;
  }

  /** Load admin approvers for mobile leave notifications. */
  private findApproverIdsForNotification(
    tenantId: string,
    siteId?: string | null,
  ) {
    const scopedSiteFilter = siteId
      ? [
          {
            OR: [
              { siteId },
              { siteId: null },
              { userSites: { some: { siteId } } },
            ],
          },
        ]
      : [];

    return prisma.user.findMany({
      where: {
        isActive: true,
        tenantId,
        OR: [
          { role: { name: { in: ["SUPER_ADMIN", "Super Admin"] } } },
          {
            AND: [
              {
                role: {
                  permission: {
                    some: { resource: "izin", action: "verify" },
                  },
                },
              },
              ...scopedSiteFilter,
            ],
          },
        ],
      },
      select: { id: true },
    });
  }

  /** Create leave request from mobile payload. */
  async createLeaveRequest(
    input: MobileLeaveRequestInput,
  ): Promise<NextResponse | { id: string }> {
    try {
      const {
        userId,
        tenantId,
        type,
        startDate,
        endDate,
        reason,
        photos,
        replacementDate,
      } = input;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const currentYear = start.getFullYear();

      const userData = await this.findRequesterContext(userId, tenantId);

      const leaveDays = await calculateWorkingDays(
        start,
        end,
        userData?.workDays || null,
        undefined,
        tenantId,
      );

      if (type === "TUKAR_LIBUR") {
        const validation = await validateTukarLiburRules(
          {
            userId,
            tenantId,
            startDate: start,
            replacementDate: replacementDate
              ? new Date(replacementDate)
              : undefined,
            workDays: userData?.workDays || null,
          },
          {
            isHoliday: async (date, currentTenantId) => {
              return this.holidayRepository.isHoliday(date, currentTenantId);
            },
          },
        );

        if ("error" in validation) {
          return apiError(validation.error, ErrorCodes.VALIDATION_ERROR, {
            status: 400,
          });
        }
      }

      if (userData?.workingHourMode !== "FLEXIBLE" && type !== "TUKAR_LIBUR") {
        const hasEnough = await this.leaveBalanceRepository.hasEnoughDays(
          userId,
          currentYear,
          type as LeaveType,
          leaveDays,
          tenantId,
        );

        if (!hasEnough) {
          const remaining = await this.leaveBalanceRepository.getRemainingDays(
            userId,
            currentYear,
            type as LeaveType,
            tenantId,
          );

          return NextResponse.json(
            {
              error: `Kuota ${type} tidak cukup. Sisa: ${remaining} hari, Dibutuhkan: ${leaveDays} hari.`,
            },
            { status: 400 },
          );
        }
      }

      if (
        type !== "CUTI" &&
        type !== "TUKAR_LIBUR" &&
        (!photos || photos.length === 0)
      ) {
        return apiError(
          "Foto bukti wajib diupload",
          ErrorCodes.VALIDATION_ERROR,
          { status: 400 },
        );
      }

      const attachments: string[] = [];
      if (photos && photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];

          if (photo.startsWith("http") || photo.startsWith("/uploads")) {
            attachments.push(photo);
            continue;
          }

          const timestamp = Date.now();
          const fileName = `leave_${userId}_${timestamp}_${i}`;
          const uploadDir = "public/uploads/employee-leave";
          const url = await convertAndSaveBase64(
            photo,
            uploadDir,
            fileName,
            "employee-leave",
          );
          if (url) attachments.push(url);
        }
      }

      const createData: Record<string, unknown> = {
        userId,
        type: type as LeaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        replacementDate: replacementDate ? new Date(replacementDate) : null,
        reason,
        attachments,
        status: LeaveStatus.PENDING,
        tenantId,
      };

      if (attachments.length > 0) {
        createData.attachmentUrl = attachments[0];
      }

      const requestData = await this.leaveRepository.create(
        createData as unknown as Prisma.LeaveRequestUncheckedCreateInput,
      );

      try {
        const admins = await this.findApproverIdsForNotification(
          tenantId,
          userData?.siteId,
        );

        for (const admin of admins) {
          await createNotification({
            type: "SYSTEM",
            priority: "NORMAL",
            title: "📋 Pengajuan Izin Baru (Mobile)",
            message: `${userData?.name} mengajukan ${type}: ${reason}`,
            link: "/admin/kehadiran/izin",
            userId: admin.id,
            sourceType: "LEAVE",
            sourceId: requestData.id,
            tenantId,
          });
        }
      } catch (error) {
        console.error("Failed to notify admins", error);
      }

      return requestData;
    } catch (error: unknown) {
      console.error("Leave request error:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Terjadi kesalahan" },
        { status: 500 },
      );
    }
  }
}
