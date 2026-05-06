export const LOGO_CONSTANTS = {
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  MAX_FILE_SIZE_MB: 5,
  SUCCESS_MESSAGE_DURATION_MS: 3000,
  PREVIEW_SIZE: {
    WIDTH: 192, // w-48 = 12rem = 192px
    HEIGHT: 192,
  },
} as const;

export const LOGO_API = {
  SETTINGS: "/api/settings/logo",
} as const;

export const LOGO_MESSAGES = {
  ERROR: {
    INVALID_FILE_TYPE: "File harus berupa gambar (PNG, JPG, JPEG)",
    FILE_TOO_LARGE: `Ukuran file maksimal ${LOGO_CONSTANTS.MAX_FILE_SIZE_MB}MB`,
    LOAD_FAILED: "Gagal memuat pengaturan",
    UPLOAD_FAILED: "Gagal mengupload logo",
    DELETE_FAILED: "Gagal menghapus logo",
  },
  SUCCESS: {
    UPLOAD: "Logo berhasil diupdate",
    DELETE: "Logo berhasil dihapus",
  },
  LOADING: "Memuat pengaturan...",
} as const;

export type LogoType = "invoice" | "aplikasi" | "landing";

export const LOGO_TYPE_CONFIG: Record<
  LogoType,
  {
    title: string;
    description: string;
    placeholder: string;
  }
> = {
  invoice: {
    title: "Logo Invoice",
    description:
      "Logo yang akan ditampilkan pada invoice. Format yang didukung: PNG, JPG, JPEG (maksimal 5MB)",
    placeholder: "Belum ada logo",
  },
  aplikasi: {
    title: "Logo Aplikasi",
    description:
      "Logo yang akan ditampilkan di aplikasi. Format yang didukung: PNG, JPG, JPEG (maksimal 5MB)",
    placeholder: "Belum ada logo",
  },
  landing: {
    title: "Logo Landing Page",
    description:
      "Logo yang akan ditampilkan di halaman landing page publik. Format yang didukung: PNG, JPG, JPEG (maksimal 5MB)",
    placeholder: "Belum ada logo",
  },
} as const;
