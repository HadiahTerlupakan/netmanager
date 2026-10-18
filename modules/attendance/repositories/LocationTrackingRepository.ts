import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

import type { ILocationTrackingRepository } from "../domain/ports/ILocationTrackingRepository";
import type { LocationDataEntity } from "../domain/entities/LocationTrackingEntity";
import { toEmployeeLocationEntity } from "../mappers/AttendanceDomainMapper";

export type LocationData = LocationDataEntity;

export class LocationTrackingRepository implements ILocationTrackingRepository {
  /**
   * Persist a single location point. A point the user already sent (same
   * `recordedAt`) is not stored twice: a request that timed out on the phone
   * after the server saved it comes back through the offline queue.
   * Returns null for such a duplicate.
   */
  async createLocation(
    userId: string,
    tenantId: string | null | undefined,
    data: LocationData,
  ) {
    const recordedAt = data.recordedAt ?? new Date();
    const existing = await prisma.employeeLocation.findFirst({
      where: { userId, recordedAt },
      select: { id: true },
    });
    if (existing) return null;

    const location = await prisma.employeeLocation.create({
      data: toLocationRow(userId, tenantId, { ...data, recordedAt }),
    });

    return toEmployeeLocationEntity(location);
  }

  /** Persist multiple location points, skipping ones already stored. */
  async createLocationsBatch(
    userId: string,
    tenantId: string | null | undefined,
    locations: LocationData[],
  ) {
    const rows = uniqueByRecordedAt(locations);
    if (rows.length === 0) return { count: 0 };

    const stored = await prisma.employeeLocation.findMany({
      where: {
        userId,
        recordedAt: { in: rows.map((row) => row.recordedAt) },
      },
      select: { recordedAt: true },
    });
    const storedTimes = new Set(stored.map((row) => row.recordedAt.getTime()));
    const fresh = rows.filter(
      (row) => !storedTimes.has(row.recordedAt.getTime()),
    );
    if (fresh.length === 0) return { count: 0 };

    return prisma.employeeLocation.createMany({
      data: fresh.map((row) => toLocationRow(userId, tenantId, row)),
    });
  }

  /** Read the latest location snapshot for each user. */
  async getLatestLocationsForUsers(
    userIds: string[],
    effectiveTenantId: string | null | undefined,
    isSuperAdmin: boolean,
    recordedSince: Date,
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
            AND "recordedAt" >= ${recordedSince}
            ${!isSuperAdmin && effectiveTenantId ? Prisma.sql`AND "tenantId" = ${effectiveTenantId}` : Prisma.empty}
            ORDER BY "userId", "recordedAt" DESC
        `;

    return locations.map(toEmployeeLocationEntity);
  }

  /** Waktu titik satu user dalam satu rentang, untuk laporan jeda tracking. */
  async findRecordedAtForUser(input: { userId: string; from: Date; to: Date }) {
    const rows = await prisma.employeeLocation.findMany({
      where: {
        userId: input.userId,
        recordedAt: { gte: input.from, lte: input.to },
      },
      select: { recordedAt: true },
    });
    return rows.map((row) => row.recordedAt);
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
        heading: true,
        altitude: true,
        batteryLevel: true,
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

type LocationRowInput = LocationData & { recordedAt: Date };

function toLocationRow(
  userId: string,
  tenantId: string | null | undefined,
  data: LocationRowInput,
) {
  return {
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
    recordedAt: data.recordedAt,
  };
}

/** Satu titik per `recordedAt`; titik tanpa waktu dicap sekarang. */
function uniqueByRecordedAt(locations: LocationData[]): LocationRowInput[] {
  const byTime = new Map<number, LocationRowInput>();
  for (const location of locations) {
    const recordedAt = location.recordedAt ?? new Date();
    byTime.set(recordedAt.getTime(), { ...location, recordedAt });
  }
  return [...byTime.values()];
}
