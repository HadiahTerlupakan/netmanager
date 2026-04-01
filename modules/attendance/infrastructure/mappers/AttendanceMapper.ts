import { Prisma, type Attendance as PrismaAttendance, type AttendanceStatus as PrismaStatus } from '@prisma/client'
import { Attendance } from '../../domain/entities/Attendance'
import { AttendanceStatus } from '../../domain/value-objects/AttendanceStatus'

/**
 * Maps between Prisma Attendance model and domain Attendance entity.
 * This is the ONLY place where Prisma types interact with domain types.
 */
export class AttendanceMapper {
  static toDomain(prisma: PrismaAttendance): Attendance {
    return new Attendance({
      id: prisma.id,
      userId: prisma.userId,
      checkIn: prisma.checkIn,
      checkInDate: prisma.checkInDate,
      checkOut: prisma.checkOut,
      checkInPhoto: prisma.checkInPhoto,
      checkOutPhoto: prisma.checkOutPhoto,
      status: AttendanceStatus.fromString(prisma.status),
      notes: prisma.notes,
      location: prisma.location,
      checkOutLocation: prisma.checkOutLocation,
      geofenceStatus: prisma.geofenceStatus,
      geofenceDistance: prisma.geofenceDistance,
      geofenceSiteName: prisma.geofenceSiteName,
      checkOutGeofenceStatus: prisma.checkOutGeofenceStatus,
      checkOutGeofenceDistance: prisma.checkOutGeofenceDistance,
      geofenceMeta: prisma.geofenceMeta as Record<string, unknown> | null,
      tenantId: prisma.tenantId,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    })
  }

  static toPrisma(domain: Attendance): {
    id: string
    userId: string
    checkIn: Date
    checkInDate: Date | null
    checkOut: Date | null
    checkInPhoto: string | null
    checkOutPhoto: string | null
    status: PrismaStatus
    notes: string | null
    location: string | null
    checkOutLocation: string | null
    geofenceStatus: string | null
    geofenceDistance: number | null
    geofenceSiteName: string | null
    checkOutGeofenceStatus: string | null
    checkOutGeofenceDistance: number | null
    geofenceMeta: unknown
    tenantId: string | null
    createdAt: Date
    updatedAt: Date
  } {
    const props = domain.toJSON()
    return {
      id: props.id,
      userId: props.userId,
      checkIn: props.checkIn,
      checkInDate: props.checkInDate,
      checkOut: props.checkOut,
      checkInPhoto: props.checkInPhoto,
      checkOutPhoto: props.checkOutPhoto,
      status: props.status.value as PrismaStatus,
      notes: props.notes,
      location: props.location,
      checkOutLocation: props.checkOutLocation,
      geofenceStatus: props.geofenceStatus,
      geofenceDistance: props.geofenceDistance,
      geofenceSiteName: props.geofenceSiteName,
      checkOutGeofenceStatus: props.checkOutGeofenceStatus,
      checkOutGeofenceDistance: props.checkOutGeofenceDistance,
      geofenceMeta: props.geofenceMeta,
      tenantId: props.tenantId,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    }
  }

  static toPrismaCreate(domain: Attendance): Prisma.AttendanceUncheckedCreateInput {
    const props = domain.toJSON()
    return {
      id: props.id,
      userId: props.userId,
      checkIn: props.checkIn,
      checkInDate: props.checkInDate,
      checkOut: props.checkOut,
      checkInPhoto: props.checkInPhoto,
      checkOutPhoto: props.checkOutPhoto,
      status: props.status.value as PrismaStatus,
      notes: props.notes,
      location: props.location,
      checkOutLocation: props.checkOutLocation,
      geofenceStatus: props.geofenceStatus,
      geofenceDistance: props.geofenceDistance,
      geofenceSiteName: props.geofenceSiteName,
      checkOutGeofenceStatus: props.checkOutGeofenceStatus,
      checkOutGeofenceDistance: props.checkOutGeofenceDistance,
      geofenceMeta: props.geofenceMeta as Prisma.InputJsonValue | undefined,
      tenantId: props.tenantId,
      updatedAt: props.updatedAt,
    }
  }

  static toPrismaUpdate(domain: Attendance): Prisma.AttendanceUncheckedUpdateInput {
    const props = domain.toJSON()
    return {
      userId: props.userId,
      checkIn: props.checkIn,
      checkInDate: props.checkInDate,
      checkOut: props.checkOut,
      checkInPhoto: props.checkInPhoto,
      checkOutPhoto: props.checkOutPhoto,
      status: props.status.value as PrismaStatus,
      notes: props.notes,
      location: props.location,
      checkOutLocation: props.checkOutLocation,
      geofenceStatus: props.geofenceStatus,
      geofenceDistance: props.geofenceDistance,
      geofenceSiteName: props.geofenceSiteName,
      checkOutGeofenceStatus: props.checkOutGeofenceStatus,
      checkOutGeofenceDistance: props.checkOutGeofenceDistance,
      geofenceMeta: props.geofenceMeta as Prisma.InputJsonValue | undefined,
      tenantId: props.tenantId,
      updatedAt: props.updatedAt,
    }
  }

  static toDomainList(prismaList: PrismaAttendance[]): Attendance[] {
    return prismaList.map((p) => this.toDomain(p))
  }
}
