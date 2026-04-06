import { SettingsRepository, type SettingsRecord, type SettingsUpsertInput } from '../repositories/SettingsRepository'

export type RingtoneSettingsPayload = {
  enabled: boolean
  soundType: 'default' | 'custom'
  customSoundData: string | null
  customSoundName: string | null
}

const RINGTONE_SETTINGS_KEYS = [
  'chat_sound_enabled',
  'chat_sound_type',
  'chat_custom_sound_data',
  'chat_custom_sound_name',
] as const

export function mapRingtoneSettingsResponse(records: SettingsRecord[]): RingtoneSettingsPayload {
  const settingsMap = new Map(records.map((record) => [record.key, record.value]))

  const enabledRaw = settingsMap.get('chat_sound_enabled')
  const typeRaw = settingsMap.get('chat_sound_type')
  const customData = settingsMap.get('chat_custom_sound_data')
  const customName = settingsMap.get('chat_custom_sound_name')

  return {
    enabled: enabledRaw !== 'false',
    soundType: typeRaw === 'custom' ? 'custom' : 'default',
    customSoundData: customData || null,
    customSoundName: customName || 'Custom Tone',
  }
}

export function buildRingtoneSettingsUpserts(payload: RingtoneSettingsPayload): SettingsUpsertInput[] {
  const normalizedData = payload.customSoundData && payload.customSoundData.length > 0 ? payload.customSoundData : null
  const normalizedName = payload.customSoundName?.trim() ? payload.customSoundName.trim() : null

  return [
    {
      key: 'chat_sound_enabled',
      value: String(payload.enabled),
      description: 'Aktifkan atau nonaktifkan suara notifikasi chat',
    },
    {
      key: 'chat_sound_type',
      value: payload.soundType,
      description: 'Jenis nada dering chat (default/custom)',
    },
    {
      key: 'chat_custom_sound_data',
      value: normalizedData,
      description: 'Data audio custom base64 untuk nada dering chat',
    },
    {
      key: 'chat_custom_sound_name',
      value: normalizedName,
      description: 'Nama file custom yang diunggah untuk nada dering',
    },
  ]
}

export async function getRingtoneSettings(): Promise<RingtoneSettingsPayload> {
  const records = await SettingsRepository.findManyByKeys(RINGTONE_SETTINGS_KEYS)
  return mapRingtoneSettingsResponse(records)
}

export async function saveRingtoneSettings(payload: RingtoneSettingsPayload): Promise<void> {
  await SettingsRepository.upsertMany(buildRingtoneSettingsUpserts(payload))
}
