import { clientLogger } from "@/lib/client-logger";

/**
 * Nada notifikasi bawaan untuk admin dan portal pelanggan. Berkasnya sama
 * dengan nada aplikasi mobile (`assets/sounds/notif_soft.wav` di repo
 * mobile-netmanager, disintesis oleh `scripts/generate-notification-sound.py`
 * di sana), supaya satu notifikasi terdengar sama di mana pun.
 */
export const NOTIFICATION_SOUND_SRC = "/sounds/notification.wav";

/**
 * Lama halaman diam setelah dibuka, setelah realtime tersambung ulang, dan
 * setelah tab kembali aktif. Notifikasi yang sudah menumpuk hanya memperbarui
 * badge; yang datang di dalam jeda ini pun diam.
 */
export const NOTIFICATION_QUIET_PERIOD_MS = 5_000;

/** Jarak minimum dua nada, dihitung bersama oleh semua hook dan semua tab. */
export const NOTIFICATION_SOUND_THROTTLE_MS = 2_000;

/**
 * Tab yang belum pernah disentuh pengguna biasanya ditolak autoplay. Bila ia
 * mengambil giliran lebih dulu, tidak ada yang terdengar sama sekali; jadi ia
 * menunggu sebentar supaya tab yang bisa berbunyi mendahuluinya.
 */
const UNTOUCHED_TAB_DELAY_MS = 300;

const CUSTOMER_SOUND_PREFERENCE_KEY = "customer_notification_sound";
const STAFF_SOUND_ENABLED_KEY = "chat_sound_enabled";
const STAFF_SOUND_TYPE_KEY = "chat_sound_type";
const STAFF_CUSTOM_SOUND_KEY = "chat_custom_sound_data";
const LAST_SOUND_AT_KEY = "notification_sound_last_played_at";
const SOUND_LOCK_NAME = "notification-sound";

let soundsHeldUntil = Number.NEGATIVE_INFINITY;
let lastSoundAtInThisTab = Number.NEGATIVE_INFINITY;

function noop(): void {}

/** Pelanggan mendengar nada kecuali mematikannya di halaman Profil. */
export function isCustomerNotificationSoundEnabled(): boolean {
  try {
    return localStorage.getItem(CUSTOMER_SOUND_PREFERENCE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setCustomerNotificationSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(CUSTOMER_SOUND_PREFERENCE_KEY, String(enabled));
  } catch {
    // Penyimpanan diblokir (mode privat): pilihannya tidak bisa diingat.
  }
}

/**
 * Mulai jeda tenang: dipanggil saat halaman dibuka, saat listener realtime
 * dipasang atau menyusul setelah koneksi putus, dan saat tab kembali aktif.
 */
export function holdNotificationSounds(): void {
  // Selalu dihitung dari sekarang, bukan diambil yang terjauh: batas lama
  // dari sebelum jam perangkat mundur tidak boleh menelan jeda yang baru.
  soundsHeldUntil = Date.now() + NOTIFICATION_QUIET_PERIOD_MS;
}

/** Nada notifikasi staf, mengikuti pengaturan nada dering di browser ini. */
export function playStaffNotificationSound(): void {
  const source = getStaffSoundSource();
  if (source) playOncePerWindow(source);
}

/** Tombol uji nada staf: langsung berbunyi, tanpa jeda tenang atau batas. */
export function previewStaffNotificationSound(): void {
  const source = getStaffSoundSource();
  if (source) startAudio(source);
}

/** Nada notifikasi portal pelanggan. */
export function playCustomerNotificationSound(): void {
  if (isCustomerNotificationSoundEnabled()) {
    playOncePerWindow(NOTIFICATION_SOUND_SRC);
  }
}

/** Pratinjau saat pelanggan menyalakan bunyi di halaman Profil. */
export function previewCustomerNotificationSound(): void {
  startAudio(NOTIFICATION_SOUND_SRC);
}

/** Sumber nada staf; null bila nada dering dimatikan. */
function getStaffSoundSource(): string | null {
  try {
    if (localStorage.getItem(STAFF_SOUND_ENABLED_KEY) === "false") return null;

    const customSound = localStorage.getItem(STAFF_CUSTOM_SOUND_KEY);
    const isCustomChosen =
      localStorage.getItem(STAFF_SOUND_TYPE_KEY) === "custom";
    return isCustomChosen && customSound ? customSound : NOTIFICATION_SOUND_SRC;
  } catch {
    // Penyimpanan diblokir: pengaturan tidak terbaca, berlaku bawaannya.
    return NOTIFICATION_SOUND_SRC;
  }
}

/**
 * Notifikasi beruntun, beberapa hook yang menangani event yang sama, dan
 * beberapa tab yang menerimanya bersamaan terdengar sebagai satu nada.
 */
function playOncePerWindow(source: string): void {
  // Browser tanpa API ini diperlakukan seperti tab yang sudah disentuh.
  const hasUserTouchedTab = navigator.userActivation?.hasBeenActive ?? true;
  if (hasUserTouchedTab) {
    ringUnlessHeld(source);
    return;
  }

  setTimeout(() => ringUnlessHeld(source), UNTOUCHED_TAB_DELAY_MS);
}

function isHeld(now: number): boolean {
  // Batas yang lebih jauh dari satu jeda berarti jam perangkat mundur.
  const remaining = soundsHeldUntil - now;
  return remaining > 0 && remaining <= NOTIFICATION_QUIET_PERIOD_MS;
}

function ringUnlessHeld(source: string): void {
  if (isHeld(Date.now())) return;

  const locks = "locks" in navigator ? navigator.locks : null;
  if (!locks) {
    if (claimSoundSlot()) startAudio(source);
    return;
  }

  // Lock dipegang sepanjang jendela. Tulisan localStorage sampai ke tab lain
  // secara asinkron, jadi tab yang memproses event yang sama pada saat yang
  // sama bisa membaca stempel lama; lock tidak.
  void locks
    .request(SOUND_LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock || !claimSoundSlot()) return;
      startAudio(source);
      await new Promise((resolve) =>
        setTimeout(resolve, NOTIFICATION_SOUND_THROTTLE_MS),
      );
    })
    .catch((error: unknown) => {
      clientLogger.info("[NotificationSound] Lock unavailable:", error);
      if (claimSoundSlot()) startAudio(source);
    });
}

/** Ambil giliran berbunyi bila nada terakhir, di tab mana pun, sudah lewat. */
function claimSoundSlot(): boolean {
  const now = Date.now();
  // Stempel dari masa depan berarti jam mundur; ia tidak boleh membungkam tab,
  // dan tidak boleh menutupi stempel tab lain yang masih berlaku.
  const isWithinWindow = (playedAt: number) => {
    const elapsed = now - playedAt;
    return elapsed >= 0 && elapsed < NOTIFICATION_SOUND_THROTTLE_MS;
  };
  if (
    isWithinWindow(lastSoundAtInThisTab) ||
    isWithinWindow(readSharedLastSoundAt())
  ) {
    return false;
  }

  lastSoundAtInThisTab = now;
  writeSharedLastSoundAt(now);
  return true;
}

function readSharedLastSoundAt(): number {
  try {
    const stored = Number(localStorage.getItem(LAST_SOUND_AT_KEY));
    return stored > 0 ? stored : Number.NEGATIVE_INFINITY;
  } catch {
    return Number.NEGATIVE_INFINITY;
  }
}

function writeSharedLastSoundAt(playedAt: number): void {
  try {
    localStorage.setItem(LAST_SOUND_AT_KEY, String(playedAt));
  } catch {
    // Penyimpanan diblokir: batas antartab hilang, batas di tab ini tetap.
  }
}

/**
 * Browser menolak memutar suara sebelum pengguna berinteraksi dengan halaman;
 * penolakan itu wajar dan tidak boleh muncul sebagai galat.
 */
function startAudio(source: string): void {
  try {
    const playable = toPlayableSource(source);
    const audio = new Audio(playable.url);
    audio.onended = playable.release;
    void audio.play().catch((error: unknown) => {
      playable.release();
      clientLogger.info("[NotificationSound] Play blocked:", error);
    });
  } catch (error) {
    clientLogger.info("[NotificationSound] Audio unavailable:", error);
  }
}

/**
 * Nada unggahan disimpan sebagai data URI, yang gagal diputar di sebagian
 * browser bila besar; ia diputar sebagai blob URL yang dilepas sesudahnya.
 */
function toPlayableSource(source: string): {
  url: string;
  release: () => void;
} {
  if (!source.startsWith("data:")) return { url: source, release: noop };

  try {
    const [header = "", base64 = ""] = source.split(",");
    const mimeType =
      header.slice("data:".length).split(";")[0] || "application/octet-stream";
    const bytes = Uint8Array.from(atob(base64), (character) =>
      character.charCodeAt(0),
    );
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    return { url, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    clientLogger.error("[NotificationSound] Data URI to blob failed:", error);
    return { url: source, release: noop };
  }
}
