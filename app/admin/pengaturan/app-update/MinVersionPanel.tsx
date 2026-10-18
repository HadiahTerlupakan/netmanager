import { Button } from "@/components/ui/Button";

export interface MinVersionRelease {
  versionCode: number;
  versionName: string | null;
  firstSeenAt: string;
  enforcedFrom: string;
  cancelledAt: string | null;
  status: "REQUIRED" | "GRACE" | "LOCKED_OUT" | "CANCELLED";
}

export interface MinVersionOverview {
  credentialConfigured: boolean;
  minimum: { versionCode: number; versionName: string | null } | null;
  releases: MinVersionRelease[];
}

const STATUS_LABEL: Record<MinVersionRelease["status"], string> = {
  REQUIRED: "Wajib",
  GRACE: "Masa jeda",
  LOCKED_OUT: "Ditolak",
  CANCELLED: "Dibatalkan",
};

const STATUS_CLASS: Record<MinVersionRelease["status"], string> = {
  REQUIRED:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  GRACE: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  LOCKED_OUT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const formatTime = (value: string) =>
  new Date(value).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const versionLabel = (release: {
  versionCode: number;
  versionName: string | null;
}) => `${release.versionName ?? "?"} (build ${release.versionCode})`;

interface Props {
  overview: MinVersionOverview;
  canUpdate: boolean;
  busy: boolean;
  onToggle: (release: MinVersionRelease) => void;
  onEnforceNow: (release: MinVersionRelease) => void;
  onSync: () => void;
}

/** Status penguncian versi aplikasi mobile berdasarkan rilis produksi Play Store. */
export function MinVersionPanel({
  overview,
  canUpdate,
  busy,
  onToggle,
  onEnforceNow,
  onSync,
}: Props) {
  return (
    <div className="space-y-4">
      {!overview.credentialConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          Belum terhubung ke Google Play. Pasang secret
          GOOGLE_PLAY_SERVICE_ACCOUNT_JSON di server; sebelum itu tidak ada
          versi yang dikunci.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {overview.minimum
            ? `Versi minimum saat ini: ${versionLabel(overview.minimum)}. Versi di bawahnya tidak bisa login di aplikasi mobile.`
            : "Belum ada versi yang dikunci."}
        </p>
        {canUpdate && overview.credentialConfigured && (
          <Button onClick={onSync} disabled={busy}>
            Sinkronkan sekarang
          </Button>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Rilis produksi baru diwajibkan 2 hari sesudah terdeteksi. Bila rilis
        bermasalah atau review Google belum selesai, batalkan rilis itu; versi
        sebelumnya tetap bisa dipakai.
      </p>

      <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
        {overview.releases.map((release) => (
          <div
            key={release.versionCode}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {versionLabel(release)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[release.status]}`}
                >
                  {STATUS_LABEL[release.status]}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Terdeteksi {formatTime(release.firstSeenAt)} · wajib mulai{" "}
                {formatTime(release.enforcedFrom)}
              </p>
            </div>
            {canUpdate && release.status !== "LOCKED_OUT" && (
              <div className="flex gap-2">
                {release.status === "GRACE" && (
                  <Button onClick={() => onEnforceNow(release)} disabled={busy}>
                    Wajibkan sekarang
                  </Button>
                )}
                <Button onClick={() => onToggle(release)} disabled={busy}>
                  {release.status === "CANCELLED"
                    ? "Aktifkan kembali"
                    : "Batalkan penguncian"}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
