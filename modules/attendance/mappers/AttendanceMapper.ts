/**
 * AttendanceMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { Attendance } from "@prisma/client";
import type {
  AttendanceDetailDTO,
  AttendanceListItemDTO,
  AttendanceSummaryDTO,
  CheckInResponseDTO,
  CheckOutResponseDTO,
} from "../dto/AttendanceDTO";

const MILLISECONDS_PER_HOUR = 1000 * 60 * 60;
const HOURS_ROUNDING_FACTOR = 100;

type AttendanceWithRelations = Attendance & {
  user?: {
    id: string;
    name: string | null;
    email: string;
    departments?: {
      id: string;
      name: string;
    } | null;
  } | null;
};

type AttendanceUserDTO = AttendanceDetailDTO["user"];

export class AttendanceMapper {
  /** Map attendance entity to list item DTO. */
  static toListItem(entity: AttendanceWithRelations): AttendanceListItemDTO {
    return {
      id: entity.id,
      date: this.formatDateOnly(entity.checkIn),
      checkInTime: this.formatDateTime(entity.checkIn),
      checkOutTime: this.formatDateTime(entity.checkOut),
      status: entity.status,
      totalHours: this.calculateHours(entity.checkIn, entity.checkOut),
      location: entity.location,
      userName: entity.user?.name ?? null,
      userEmail: entity.user?.email ?? null,
      departmentName: entity.user?.departments?.name ?? null,
    };
  }

  /** Map attendance entities to list item DTOs. */
  static toListItems(
    entities: AttendanceWithRelations[],
  ): AttendanceListItemDTO[] {
    return entities.map((entity) => this.toListItem(entity));
  }

  /** Map attendance entity to detail DTO. */
  static toDetail(entity: AttendanceWithRelations): AttendanceDetailDTO {
    return {
      id: entity.id,
      date: this.formatDateOnly(entity.checkIn),
      checkInTime: this.formatDateTime(entity.checkIn),
      checkOutTime: this.formatDateTime(entity.checkOut),
      status: entity.status,
      totalHours: this.calculateHours(entity.checkIn, entity.checkOut),
      location: entity.location,
      notes: entity.notes,
      checkInPhoto: entity.checkInPhoto,
      checkOutPhoto: entity.checkOutPhoto,
      geofence: this.mapGeofence(entity),
      user: this.mapDetailUser(entity),
      createdAt: this.formatRequiredDateTime(entity.createdAt),
      updatedAt: this.formatRequiredDateTime(entity.updatedAt),
    };
  }

  /** Map attendance entity to check-in response DTO. */
  static toCheckInResponse(
    entity: Attendance,
    message = "Check-in berhasil",
  ): CheckInResponseDTO {
    return {
      id: entity.id,
      checkInTime: this.formatRequiredDateTime(entity.checkIn),
      status: entity.status,
      location: entity.location,
      geofenceStatus: entity.geofenceStatus,
      geofenceSiteName: entity.geofenceSiteName,
      message,
    };
  }

  /** Map attendance entity to check-out response DTO. */
  static toCheckOutResponse(
    entity: Attendance,
    message = "Check-out berhasil",
  ): CheckOutResponseDTO {
    return {
      id: entity.id,
      checkInTime: this.formatRequiredDateTime(entity.checkIn),
      checkOutTime: this.formatRequiredDateTime(entity.checkOut),
      totalHours: this.calculateHours(entity.checkIn, entity.checkOut) ?? 0,
      status: entity.status,
      message,
    };
  }

  /** Create summary DTO from aggregated data. */
  static toSummary(data: {
    date: Date;
    totalEmployees: number;
    present: number;
    late: number;
    absent: number;
    onLeave: number;
  }): AttendanceSummaryDTO {
    return {
      date: this.formatDateOnly(data.date),
      totalEmployees: data.totalEmployees,
      present: data.present,
      late: data.late,
      absent: data.absent,
      onLeave: data.onLeave,
      percentagePresent: this.calculatePresencePercentage(data),
    };
  }

  private static mapGeofence(entity: AttendanceWithRelations) {
    return {
      status: entity.geofenceStatus,
      distance: entity.geofenceDistance,
      siteName: entity.geofenceSiteName,
    };
  }

  private static mapDetailUser(
    entity: AttendanceWithRelations,
  ): AttendanceUserDTO {
    if (entity.user) {
      return {
        id: entity.user.id,
        name: entity.user.name,
        email: entity.user.email,
        departmentName: entity.user.departments?.name ?? null,
      };
    }

    return {
      id: entity.userId,
      name: null,
      email: "",
      departmentName: null,
    };
  }

  private static calculatePresencePercentage(data: {
    totalEmployees: number;
    present: number;
    late: number;
  }) {
    if (data.totalEmployees <= 0) return 0;

    return Math.round(((data.present + data.late) / data.totalEmployees) * 100);
  }

  private static calculateHours(
    checkIn: Date | null,
    checkOut: Date | null,
  ): number | null {
    if (!checkIn || !checkOut) return null;

    const diffMs = checkOut.getTime() - checkIn.getTime();
    const hours = diffMs / MILLISECONDS_PER_HOUR;

    return Math.round(hours * HOURS_ROUNDING_FACTOR) / HOURS_ROUNDING_FACTOR;
  }

  private static formatDateOnly(value: Date | null | undefined) {
    return value?.toISOString().split("T")[0] ?? "";
  }

  private static formatDateTime(value: Date | null | undefined) {
    return value?.toISOString() ?? null;
  }

  private static formatRequiredDateTime(value: Date | null | undefined) {
    return value?.toISOString() ?? "";
  }
}
