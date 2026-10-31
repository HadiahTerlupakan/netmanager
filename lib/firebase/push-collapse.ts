/**
 * Kunci penggabung push per kategori, untuk FCM maupun Expo. Selama ponsel
 * offline atau aplikasi tertutup, push disimpan, lalu Android menampilkan sekaligus
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
  /** Nilai `sourceType` (notifikasi) atau `type` (push Expo) di data push. */
  kinds: readonly string[];
  /** Segmen `url`/`link`, untuk pengirim yang hanya menyertakan tautan. */
  pathSegments: readonly string[];
}

const COLLAPSE_CATEGORIES: readonly CollapseCategory[] = [
  {
    key: "workorder",
    kinds: ["WORK_ORDER", "WO_REQUEST"],
    pathSegments: ["workorders", "work-orders"],
  },
  {
    key: "ticket",
    kinds: ["TICKET", "KELUHAN"],
    pathSegments: ["support", "tickets", "keluhan"],
  },
  {
    key: "billing",
    kinds: ["BILLING", "INVOICE", "PaymentReview"],
    pathSegments: ["tagihan", "invoices", "payments"],
  },
  {
    key: "announcement",
    kinds: ["ANNOUNCEMENT"],
    pathSegments: ["announcement", "announcements", "pengumuman"],
  },
];

function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getPathSegments(url: string): string[] {
  const path = url.split(/[?#]/, 1)[0] ?? "";
  return path.split("/").filter(Boolean);
}

/**
 * Kunci yang sama dipakai untuk `android.collapseKey`,
 * `android.notification.tag`, dan `apns-collapse-id` di FCM, serta
 * `collapseId` dan `tag` di Expo.
 */
export function getPushCollapseKey(data: Record<string, unknown> = {}): string {
  const conversationId = readText(data.conversationId);
  if (conversationId) return `${CHAT_COLLAPSE_KEY_PREFIX}${conversationId}`;

  const kinds = [readText(data.sourceType), readText(data.type)];
  const pathSegments = getPathSegments(
    readText(data.url) || readText(data.link),
  );
  const category =
    COLLAPSE_CATEGORIES.find((candidate) =>
      kinds.some((kind) => candidate.kinds.includes(kind)),
    ) ??
    COLLAPSE_CATEGORIES.find((candidate) =>
      pathSegments.some((segment) => candidate.pathSegments.includes(segment)),
    );

  return category?.key ?? GENERAL_COLLAPSE_KEY;
}
