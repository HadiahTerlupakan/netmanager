import { SettingsRepository } from "../repositories/SettingsRepository";
import type {
  SettingsEntity,
  SettingsUpsertEntity,
} from "../domain/entities/Settings";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";

export type RingtoneSettingsPayload = {
  enabled: boolean;
  soundType: "default" | "custom";
  customSoundData: string | null;
  customSoundName: string | null;
};

const RINGTONE_SETTINGS_KEYS = [
  "chat_sound_enabled",
  "chat_sound_type",
  "chat_custom_sound_data",
  "chat_custom_sound_name",
] as const;

const defaultSettingsRepository: ISettingsRepository = SettingsRepository;

/** Maps settings entities into ringtone settings payload. */
export function mapRingtoneSettingsResponse(
  records: SettingsEntity[],
): RingtoneSettingsPayload {
  const settingsMap = new Map(
    records.map((record) => [record.key, record.value]),
  );

  const enabledRaw = settingsMap.get("chat_sound_enabled");
  const typeRaw = settingsMap.get("chat_sound_type");
  const customData = settingsMap.get("chat_custom_sound_data");
  const customName = settingsMap.get("chat_custom_sound_name");

  return {
    enabled: enabledRaw !== "false",
    soundType: typeRaw === "custom" ? "custom" : "default",
    customSoundData: customData || null,
    customSoundName: customName || "Custom Tone",
  };
}

/** Builds repository upserts for ringtone settings payload. */
export function buildRingtoneSettingsUpserts(
  payload: RingtoneSettingsPayload,
): SettingsUpsertEntity[] {
  const normalizedData =
    payload.customSoundData && payload.customSoundData.length > 0
      ? payload.customSoundData
      : null;
  const normalizedName = payload.customSoundName?.trim()
    ? payload.customSoundName.trim()
    : null;

  return [
    {
      key: "chat_sound_enabled",
      value: String(payload.enabled),
      description: "Aktifkan atau nonaktifkan suara notifikasi chat",
    },
    {
      key: "chat_sound_type",
      value: payload.soundType,
      description: "Jenis nada dering chat (default/custom)",
    },
    {
      key: "chat_custom_sound_data",
      value: normalizedData,
      description: "Data audio custom base64 untuk nada dering chat",
    },
    {
      key: "chat_custom_sound_name",
      value: normalizedName,
      description: "Nama file custom yang diunggah untuk nada dering",
    },
  ];
}

/** Gets ringtone settings. */
export async function getRingtoneSettings(
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<RingtoneSettingsPayload> {
  const records = await repository.findManyByKeys(RINGTONE_SETTINGS_KEYS);
  return mapRingtoneSettingsResponse(records);
}

/** Saves ringtone settings. */
export async function saveRingtoneSettings(
  payload: RingtoneSettingsPayload,
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<void> {
  await repository.upsertMany(buildRingtoneSettingsUpserts(payload));
}
