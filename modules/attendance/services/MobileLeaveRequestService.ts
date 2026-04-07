import { NextResponse } from "next/server";
import { LeaveStatus, LeaveType, Prisma } from "@prisma/client";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { LeaveBalanceRepository } from "../repositories/LeaveBalanceRepository";
import { calculateWorkingDays } from "../utils/calculateWorkingDays";
import { prisma } from "@/lib/prisma";
import { convertAndSaveBase64 } from "@/lib/utils/image-upload";
import { createNotification } from "@/modules/notification/services/NotificationService";
import { apiError, ErrorCodes } from "@/lib/api-response";

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
  private readonly leaveRepository: LeaveRepository;
  private readonly leaveBalanceRepository: LeaveBalanceRepository;

  constructor() {
    this.leaveRepository = new LeaveRepository();
    this.leaveBalanceRepository = new LeaveBalanceRepository();
  }

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

      const userData = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: {
          workingHourMode: true,
          workDays: true,
          name: true,
          siteId: true,
        },
      });

      const leaveDays = await calculateWorkingDays(
        start,
        end,
        userData?.workDays || null,
        undefined,
        tenantId,
      );

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

      if (type === "TUKAR_LIBUR") {
        if (!replacementDate) {
          return apiError(
            "Tanggal pengganti wajib diisi untuk Tukar Libur",
            ErrorCodes.VALIDATION_ERROR,
            { status: 400 },
          );
        }

        if (userData?.workDays) {
          const workDays = userData.workDays.split(",").map((d) => d.trim());
          const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const replacement = new Date(replacementDate);

          const startDayName = days[start.getDay()];
          const replacementDayName = days[replacement.getDay()];
          const formatDate = (date: Date) => date.toISOString().split("T")[0];

          if (!startDayName || !workDays.includes(startDayName)) {
            return NextResponse.json(
              {
                error: `Tanggal izin (${startDate}) harus merupakan Hari Kerja.`,
              },
              { status: 400 },
            );
          }

          const isOffDay = replacementDayName
            ? !workDays.includes(replacementDayName)
            : false;
          const formattedReplacementDate = formatDate(replacement);
          const holiday = formattedReplacementDate
            ? await prisma.holiday.findFirst({
                where: {
                  date: new Date(formattedReplacementDate),
                  tenantId,
                },
              })
            : null;

          if (!isOffDay && !holiday) {
            return NextResponse.json(
              {
                error: `Tanggal pengganti (${replacementDate}) harus merupakan Hari Libur atau Tanggal Merah.`,
              },
              { status: 400 },
            );
          }
        }
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
        const admins = await prisma.user.findMany({
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
                        some: {
                          resource: { in: ["attendance", "kehadiran"] },
                          action: "update",
                        },
                      },
                    },
                  },
                  ...(userData?.siteId
                    ? [
                        {
                          OR: [
                            { siteId: userData.siteId },
                            { siteId: null },
                            {
                              userSites: { some: { siteId: userData.siteId } },
                            },
                          ],
                        },
                      ]
                    : []),
                ],
              },
            ],
          },
          select: { id: true },
        });

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
