import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { LeaveStatus, LeaveType, Prisma } from "@prisma/client";
import type { IHolidayRepository } from "../domain/ports/IHolidayRepository";
import type { ILeaveBalanceRepository } from "../domain/ports/ILeaveBalanceRepository";
import type { ILeaveRepository } from "../domain/ports/ILeaveRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { LeaveBalanceRepository } from "../repositories/LeaveBalanceRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { calculateWorkingDays } from "../utils/calculateWorkingDays";
import { validateTukarLiburRules } from "./LeaveService";
import { convertAndSaveBase64 } from "@/lib/utils/image-upload";
import {
  createNotification,
  WhatsAppApprovalButtonService,
} from "@/modules/notification";
import { apiError, ErrorCodes } from "@/lib/api-response";

const LEAVE_APPROVAL_LINK = "/admin/kehadiran/izin";
const LEAVE_APPROVAL_TITLE = "Pengajuan Izin Baru (Mobile)";

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

export class MobileLeaveRequestService {
  private readonly leaveRepository: ILeaveRepository;
  private readonly leaveBalanceRepository: ILeaveBalanceRepository;
  private readonly holidayRepository: IHolidayRepository;
  private readonly whatsAppApprovalButtonService: WhatsAppApprovalButtonService;

  constructor(
    leaveRepository: ILeaveRepository = new LeaveRepository(),
    leaveBalanceRepository: ILeaveBalanceRepository = new LeaveBalanceRepository(),
    holidayRepository: IHolidayRepository = new HolidayRepository(),
  ) {
    this.leaveRepository = leaveRepository;
    this.leaveBalanceRepository = leaveBalanceRepository;
    this.holidayRepository = holidayRepository;
    this.whatsAppApprovalButtonService = new WhatsAppApprovalButtonService();
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

      const userData = await this.leaveRepository.findRequesterContext(
        userId,
        tenantId,
      );

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
        const admins =
          await this.leaveRepository.findApproverIdsForMobileLeaveNotification({
            tenantId,
            siteId: userData?.siteId,
          });

        for (const admin of admins) {
          const message = `${userData?.name} mengajukan ${type}: ${reason}`;
          await createNotification({
            type: "SYSTEM",
            priority: "NORMAL",
            title: LEAVE_APPROVAL_TITLE,
            message,
            link: LEAVE_APPROVAL_LINK,
            userId: admin.id,
            sourceType: "LEAVE",
            sourceId: requestData.id,
            tenantId,
          });
          await this.whatsAppApprovalButtonService.sendApprovalButton({
            phone: admin.phone,
            title: LEAVE_APPROVAL_TITLE,
            message,
            approvalUrl: LEAVE_APPROVAL_LINK,
          });
        }
      } catch (error) {
        logger.error("Failed to notify admins", error);
      }

      return requestData;
    } catch (error: unknown) {
      logger.error("Leave request error:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Terjadi kesalahan" },
        { status: 500 },
      );
    }
  }
}
