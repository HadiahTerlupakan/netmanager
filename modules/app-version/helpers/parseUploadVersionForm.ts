import type { UploadVersionInput } from '../services/AppVersionService'

const POSITIVE_INTEGER_PATTERN = /^\d+$/

function getStringValue(entry: FormDataEntryValue | null): string | null {
    if (typeof entry === 'string') {
        return entry
    }
    return null
}

function parsePositiveInteger(value: string | null, fieldName: string): number | undefined {
    if (!value || !value.trim()) {
        return undefined
    }

    const normalized = value.trim()
    if (!POSITIVE_INTEGER_PATTERN.test(normalized)) {
        throw new Error(`${fieldName} harus berupa angka bulat positif`)
    }

    const parsed = Number(normalized)
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${fieldName} harus berupa angka bulat positif`)
    }

    return parsed
}

function assertApkFileName(filename: string | null | undefined, message: string): void {
    if (!filename) {
        return
    }

    if (!filename.toLowerCase().endsWith('.apk')) {
        throw new Error(message)
    }
}

export function parseAppVersionUploadForm(formData: FormData): UploadVersionInput {
    const version = getStringValue(formData.get('version')) || undefined
    const buildNumberEntry = getStringValue(formData.get('buildNumber'))
    const versionCodeEntry = getStringValue(formData.get('versionCode'))
    const platform = getStringValue(formData.get('platform')) || 'android'
    const releaseNotes = getStringValue(formData.get('releaseNotes')) || undefined
    const minVersion = getStringValue(formData.get('minVersion')) || undefined
    const uploadedKey = getStringValue(formData.get('uploadedKey')) || undefined
    const uploadedFilename = getStringValue(formData.get('uploadedFilename')) || undefined
    const uploadedSizeEntry = getStringValue(formData.get('uploadedSize'))

    const buildNumber = parsePositiveInteger(buildNumberEntry, 'buildNumber')
    const versionCode = parsePositiveInteger(versionCodeEntry, 'versionCode')
    const uploadedSize = parsePositiveInteger(uploadedSizeEntry, 'uploadedSize')

    const apkEntry = formData.get('apk')
    const apkFile = apkEntry instanceof File ? apkEntry : undefined

    assertApkFileName(apkFile?.name, 'File yang diupload harus berformat APK')
    assertApkFileName(uploadedFilename, 'File direct upload harus berformat APK')

    const hasApk = Boolean(apkFile || uploadedKey)
    if (!hasApk && (!version || !buildNumber || !versionCode)) {
        throw new Error('Upload APK untuk auto-detect versi, atau isi manual version, buildNumber, dan versionCode')
    }

    return {
        platform,
        ...(version ? { version } : {}),
        ...(buildNumber ? { buildNumber } : {}),
        ...(versionCode ? { versionCode } : {}),
        ...(releaseNotes ? { releaseNotes } : {}),
        ...(minVersion ? { minVersion } : {}),
        apkFile,
        ...(apkFile && apkFile.name ? { apkFilename: apkFile.name } : {}),
        ...(apkFile ? { apkSize: apkFile.size } : {}),
        ...(uploadedKey ? { uploadedKey } : {}),
        ...(uploadedFilename ? { uploadedFilename } : {}),
        ...(typeof uploadedSize === 'number' ? { uploadedSize } : {}),
        isForceUpdate: formData.get('isForceUpdate') === 'true',
        forceLocal: formData.get('forceLocal') === 'true',
    }
}
