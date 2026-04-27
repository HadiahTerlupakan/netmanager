import type { Settings as PrismaSettings } from "@prisma/client";
import type { SettingsEntity } from "../domain/entities/Settings";

/** Maps Prisma settings model to domain entity. */
export function toSettingsDomain(model: PrismaSettings): SettingsEntity {
  return {
    key: model.key,
    value: model.value,
    encrypted: model.encrypted,
  };
}
