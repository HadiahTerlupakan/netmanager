/**
 * Kunci penggabung push FCM per kategori. Selama ponsel offline atau aplikasi
 * tertutup, FCM menyimpan push, lalu Android menampilkan sekaligus
 * membunyikan semuanya begitu tersambung lagi. Dengan kunci yang sama, push
 * satu kategori yang tertunda tinggal yang terakhir, dan notifikasi baru
 * menggantikan yang lama di baki.
 *
 * FCM hanya menyimpan empat kunci berbeda per perangkat, jadi kategorinya
 * sengaja sedikit. Obrolan dipisah per percakapan supaya percakapan yang satu
 * tidak menimpa yang lain.
 */

const GENERAL_COLLAPSE_KEY = "general";
const CHAT_COLLAPSE_KEY_PREFIX = "chat-";

interface CollapseCategory {
  key: string;
  /** Nilai `sourceType` notifikasi yang dipakai kode ini. */
  sourceTypes: readonly string[];
  /** Menangkap pengirim yang hanya menyertakan tautan. */
  pathSegments: readonly string[];
}

const COLLAPSE_CATEGORIES: readonly CollapseCategory[] = [
  {
    key: "workorder",
    sourceTypes: ["WORK_ORDER"],
    pathSegments: ["workorders", "work-orders"],
  },
  {
    key: "ticket",
    sourceTypes: ["TICKET", "KELUHAN"],
    pathSegments: ["support", "tickets", "keluhan"],
  },
  {
    key: "billing",
    sourceTypes: ["BILLING", "INVOICE", "PaymentReview"],
    pathSegments: ["tagihan", "invoices", "payments"],
  },
  {
    key: "announcement",
    sourceTypes: ["ANNOUNCEMENT"],
    pathSegments: ["announcements", "pengumuman"],
  },
];

function getPathSegments(url: string | undefined): string[] {
  const path = url?.split(/[?#]/, 1)[0] ?? "";
  return path.split("/").filter(Boolean);
}

/**
 * Kunci yang sama dipakai untuk `android.collapseKey`,
 * `android.notification.tag`, dan `apns-collapse-id`.
 */
export function getPushCollapseKey(data: Record<string, string> = {}): string {
  if (data.conversationId) {
    return `${CHAT_COLLAPSE_KEY_PREFIX}${data.conversationId}`;
  }

  const sourceType = data.sourceType ?? "";
  const pathSegments = getPathSegments(data.url);
  const category =
    COLLAPSE_CATEGORIES.find((candidate) =>
      candidate.sourceTypes.includes(sourceType),
    ) ??
    COLLAPSE_CATEGORIES.find((candidate) =>
      pathSegments.some((segment) => candidate.pathSegments.includes(segment)),
    );

  return category?.key ?? GENERAL_COLLAPSE_KEY;
}
