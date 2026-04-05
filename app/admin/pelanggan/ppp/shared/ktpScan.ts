export type KtpOcrData = {
  nama?: string
  nik?: string
  alamat_jalan?: string
  rt_rw?: string
  kel_desa?: string
  kecamatan?: string
  tempat_dikeluarkan?: string
  tempat_lahir?: string
  provinsi?: string
}

type KtpOcrResponse = {
  data?: KtpOcrData
}

type KtpEditableFields = {
  nama: string
  noDokumen: string
  alamat: string
  kabupatenKota: string
  kelurahanDesa: string
  kecamatan: string
  provinsi: string
}

export const normalizeKtpOcrErrorMessage = (
  errorMessage: unknown,
  fallback = 'Gagal memproses KTP'
): string => {
  if (typeof errorMessage === 'string' && errorMessage.trim().length > 0) {
    return errorMessage
  }

  if (errorMessage instanceof Error && errorMessage.message.trim().length > 0) {
    return errorMessage.message
  }

  return fallback
}

export const isSupportedKtpImage = (file: File): boolean => {
  return file.type.startsWith('image/')
}

export async function scanKtpOcr(file: File): Promise<KtpOcrData> {
  const formDataToSend = new FormData()
  formDataToSend.append('file', file)

  const res = await fetch('/api/ktp-ocr', {
    method: 'POST',
    body: formDataToSend,
  })

  if (!res.ok) {
    let errorMessage: unknown = `HTTP ${res.status}: ${res.statusText}`

    try {
      const text = await res.text()
      if (text) {
        const parsed = JSON.parse(text) as { error?: unknown; message?: unknown }
        errorMessage =
          (typeof parsed.error === 'string' && parsed.error) ||
          (typeof parsed.message === 'string' && parsed.message) ||
          errorMessage
      }
    } catch {
    }

    throw new Error(normalizeKtpOcrErrorMessage(errorMessage))
  }

  const result = (await res.json()) as KtpOcrResponse
  if (!result.data) {
    throw new Error('Data KTP tidak ditemukan')
  }

  return result.data
}

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

export function mergeKtpDataIntoPppForm<T extends KtpEditableFields>(prev: T, ktpData: KtpOcrData): T {
  const updated = { ...prev }

  if (hasText(ktpData.nama)) {
    updated.nama = ktpData.nama.trim()
  }

  if (hasText(ktpData.nik)) {
    updated.noDokumen = ktpData.nik.trim()
  }

  const alamatParts: string[] = []
  if (hasText(ktpData.alamat_jalan)) {
    alamatParts.push(ktpData.alamat_jalan.trim())
  }
  if (hasText(ktpData.rt_rw)) {
    alamatParts.push(`RT/RW ${ktpData.rt_rw.trim()}`)
  }
  if (hasText(ktpData.kel_desa)) {
    alamatParts.push(`Kel/Desa ${ktpData.kel_desa.trim()}`)
  }
  if (hasText(ktpData.kecamatan)) {
    alamatParts.push(`Kec. ${ktpData.kecamatan.trim()}`)
  }

  if (alamatParts.length > 0) {
    updated.alamat = alamatParts.join(', ')
  }

  if (hasText(ktpData.tempat_dikeluarkan)) {
    updated.kabupatenKota = ktpData.tempat_dikeluarkan.trim()
  } else if (hasText(ktpData.tempat_lahir)) {
    updated.kabupatenKota = ktpData.tempat_lahir.trim()
  }

  if (hasText(ktpData.kel_desa)) {
    updated.kelurahanDesa = ktpData.kel_desa.trim()
  }

  if (hasText(ktpData.kecamatan)) {
    updated.kecamatan = ktpData.kecamatan.trim()
  }

  if (hasText(ktpData.provinsi)) {
    updated.provinsi = ktpData.provinsi.trim()
  }

  return updated
}
