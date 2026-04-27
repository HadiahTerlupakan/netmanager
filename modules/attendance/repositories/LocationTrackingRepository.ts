import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

import type { ILocationTrackingRepository } from "../domain/ports/ILocationTrackingRepository";
import type { LocationDataEntity } from "../domain/entities/LocationTrackingEntity";
import { toEmployeeLocationEntity } from "../mappers/AttendanceDomainMapper";

export type LocationData = LocationDataEntity;

export class LocationTrackingRepository implements ILocationTrackingRepository {
  /** Persist a single location point. */
  async createLocation(
    userId: string,
    tenantId: string | null | undefined,
    data: LocationData,
  ) {
    const location = await prisma.employeeLocation.create({
      data: {
        userId,
        tenantId,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy ?? null,
        altitude: data.altitude ?? null,
        speed: data.speed ?? null,
        heading: data.heading ?? null,
        batteryLevel: data.batteryLevel ?? null,
        isMoving: data.isMoving ?? false,
        recordedAt: data.recordedAt ?? new Date(),
      },
    });

    return toEmployeeLocationEntity(location);
  }

  async createLocationsBatch(
    userId: string,
    tenantId: string | null | undefined,
    locations: LocationData[],
  ) {
    return prisma.employeeLocation.createMany({
      data: locations.map((loc) => ({
        userId,
        tenantId,
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy ?? null,
        altitude: loc.altitude ?? null,
        speed: loc.speed ?? null,
        heading: loc.heading ?? null,
        batteryLevel: loc.batteryLevel ?? null,
        isMoving: loc.isMoving ?? false,
        recordedAt: loc.recordedAt ?? new Date(),
      })),
    });
  }

  /** Read the latest location snapshot for each user. */
  async getLatestLocationsForUsers(
    userIds: string[],
    effectiveTenantId: string | null | undefined,
    isSuperAdmin: boolean,
  ) {
    const locations = await prisma.$queryRaw<
      Array<{
        userId: string;
        latitude: number;
        longitude: number;
        accuracy: number | null;
        speed: number | null;
        heading: number | null;
        isMoving: boolean;
        batteryLevel: number | null;
        recordedAt: Date;
      }>
    >`
            SELECT DISTINCT ON ("userId") 
                "userId", latitude, longitude, accuracy, speed, 
                heading, "isMoving", "batteryLevel", "recordedAt"
            FROM "employee_locations"
            WHERE "userId" = ANY(${userIds})
            ${!isSuperAdmin && effectiveTenantId ? Prisma.sql`AND "tenantId" = ${effectiveTenantId}` : Prisma.empty}
            ORDER BY "userId", "recordedAt" DESC
        `;

    return locations.map(toEmployeeLocationEntity);
  }

  /** Read ordered location history for a user. */
  async findLocationsByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const locations = await prisma.employeeLocation.findMany({
      where: {
        userId,
        recordedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { recordedAt: "asc" },
      select: {
        latitude: true,
        longitude: true,
        accuracy: true,
        speed: true,
        isMoving: true,
        recordedAt: true,
      },
    });

    return locations.map((location) =>
      toEmployeeLocationEntity({ ...location, userId }),
    );
  }

  async deleteLocationsBefore(date: Date) {
    return prisma.employeeLocation.deleteMany({
      where: {
        recordedAt: { lt: date },
      },
    });
  }
}
