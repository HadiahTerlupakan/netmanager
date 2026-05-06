export const API_SETTINGS_CONSTANTS = {
  SUCCESS_MESSAGE_DURATION_MS: 3000,
  SECRET_PLACEHOLDER: "********",
} as const;

export const API_SETTINGS_ENDPOINTS = {
  SETTINGS: "/api/settings/api",
  R2_TEST: "/api/settings/api/r2/test",
} as const;

export const API_SETTINGS_MESSAGES = {
  ERROR: {
    LOAD_FAILED: "Gagal memuat pengaturan",
    SAVE_FAILED: "Gagal menyimpan pengaturan",
    GENERIC: "Terjadi kesalahan saat memuat pengaturan",
    SAVE_GENERIC: "Terjadi kesalahan saat menyimpan pengaturan",
    R2_CONNECTION_FAILED: "Koneksi ke R2 gagal",
    R2_FIELDS_REQUIRED:
      "Silakan isi Account ID, Access Key ID, dan Bucket Name",
    R2_SECRET_PLACEHOLDER:
      "Silakan masukkan Secret Access Key yang baru untuk test koneksi",
    R2_SECRET_REQUIRED: "Silakan masukkan Secret Access Key",
  },
  SUCCESS: {
    SAVE: "Pengaturan API berhasil disimpan!",
    R2_TEST: "Koneksi R2 Berhasil!",
  },
  LOADING: "Memuat pengaturan API...",
  INFO: "Perubahan pada API Key mungkin membutuhkan restart service tertentu.",
} as const;
