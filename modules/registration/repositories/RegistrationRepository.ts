import { logger } from "@/lib/logger";
import type {
  Prisma,
  RegistrationStatus as PrismaRegistrationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/utils/encryption";
import { randomUUID } from "crypto";
import type {
  CreateRegistrationData,
  Registration,
  UpdateRegistrationStatusData,
} from "../domain/entities/Registration";
import type { IRegistrationRepository } from "../domain/ports/IRegistrationRepository";
import { RegistrationMapper } from "../mappers/RegistrationMapper";

const EMPTY_DATE_OFFSET_MS = 0;

export class RegistrationRepository implements IRegistrationRepository {
  /** Find a registration by id. */
  async findById(id: string): Promise<Registration | null> {
    const model = await prisma.registrations.findUnique({ where: { id } });
    return model ? RegistrationMapper.toDomain(model) : null;
  }

  /** Find all registrations ordered by creation date. */
  async findAll(): Promise<Registration[]> {
    const models = await prisma.registrations.findMany({
      orderBy: { createdAt: "desc" },
    });

    return models.map(RegistrationMapper.toDomain);
  }

  /** Find a registration by email or phone and optional status. */
  async findByEmailOrPhone(
    email: string,
    phone: string,
    status?: Registration["status"],
  ): Promise<Registration | null> {
    const model = await prisma.registrations.findFirst({
      where: {
        ...(status ? { status: this.toPrismaStatus(status) } : {}),
        OR: [{ email }, { phone }],
      },
    });

    return model ? RegistrationMapper.toDomain(model) : null;
  }

  /** Create a new registration entity. */
  async create(data: CreateRegistrationData): Promise<Registration> {
    const model = await prisma.registrations.create({
      data: this.toCreateInput(data),
    });

    return RegistrationMapper.toDomain(model);
  }

  /** Update registration status and related audit fields. */
  async updateWithDetails(
    id: string,
    data: UpdateRegistrationStatusData,
  ): Promise<Registration> {
    const model = await prisma.registrations.update({
      where: { id },
      data: this.toUpdateInput(data),
    });

    return RegistrationMapper.toDomain(model);
  }

  /** Delete a registration by id. */
  async delete(id: string): Promise<void> {
    await prisma.registrations.delete({ where: { id } });
  }

  /** Read a setting value by key. */
  async getSettingValue(key: string): Promise<string | null> {
    const setting = await prisma.settings.findFirst({
      where: { key },
      select: { value: true, encrypted: true },
    });

    if (!setting?.value) {
      return null;
    }

    if (!setting.encrypted) {
      return setting.value;
    }

    return this.decryptSettingValue(key, setting.value);
  }

  /** Map domain create data to Prisma input. */
  private toCreateInput(
    data: CreateRegistrationData,
  ): Prisma.RegistrationsCreateInput {
    return {
      id: randomUUID(),
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      packageName: data.packageName,
      location: data.location,
      ipAddress: data.ipAddress,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      notes: data.notes,
      status: this.toPrismaStatus(data.status),
      updatedAt: new Date(Date.now() + EMPTY_DATE_OFFSET_MS),
    };
  }

  /** Map domain update data to Prisma input. */
  private toUpdateInput(
    data: UpdateRegistrationStatusData,
  ): Prisma.RegistrationsUpdateInput {
    return {
      status: this.toPrismaStatus(data.status),
      notes: data.notes,
      rejectionReason: data.rejectionReason,
      verifiedAt: data.verifiedAt,
      verifiedBy: data.verifiedBy,
      updatedAt: new Date(),
    };
  }

  /** Convert domain status to Prisma status. */
  private toPrismaStatus(
    status: Registration["status"],
  ): PrismaRegistrationStatus {
    return status as PrismaRegistrationStatus;
  }

  /** Decrypt encrypted setting value safely. */
  private decryptSettingValue(key: string, encryptedValue: string): string {
    try {
      return decryptApiKey(encryptedValue);
    } catch (error) {
      logger.error(
        `[RegistrationRepository] Failed to decrypt setting: ${key}`,
        error,
      );
      return encryptedValue;
    }
  }
}
