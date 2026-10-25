export type IsolirMode = "ROUTER_PAGE" | "REDIRECT" | "ISOLIR_SERVICE";

type IsolirModeFieldProps = {
  mode: IsolirMode;
  url: string;
  /** Server isolir hanya ditawarkan untuk router VPN. */
  connectionMode?: "PUBLIC" | "VPN";
  onModeChange: (mode: IsolirMode) => void;
  onUrlChange: (url: string) => void;
  /** Form edit: mode baru baru sampai ke router setelah Reconfigurasi. */
  showReconfigureHint?: boolean;
};

const INPUT_CLASS =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500";
const LABEL_CLASS =
  "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2";

/**
 * URL hanya bermakna untuk Redirect; mode halaman di router menyimpan null
 * supaya URL lama tidak ikut terbawa bila router kembali ke mode bawaan.
 */
export function withIsolirUrlForMode<
  T extends { isolirMode: IsolirMode; isolirUrl: string },
>(formData: T): Omit<T, "isolirUrl"> & { isolirUrl: string | null } {
  return {
    ...formData,
    isolirUrl: formData.isolirMode === "REDIRECT" ? formData.isolirUrl : null,
  };
}

export function IsolirModeField({
  mode,
  url,
  connectionMode,
  onModeChange,
  onUrlChange,
  showReconfigureHint = false,
}: IsolirModeFieldProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="mikrotik-isolir-mode" className={LABEL_CLASS}>
          Mode halaman isolir
        </label>
        <select
          id="mikrotik-isolir-mode"
          value={mode}
          onChange={(event) => onModeChange(event.target.value as IsolirMode)}
          className={INPUT_CLASS}
        >
          <option value="ROUTER_PAGE">Halaman di router (bawaan)</option>
          <option value="REDIRECT">Redirect ke URL</option>
          {connectionMode === "VPN" && (
            <option value="ISOLIR_SERVICE">Server isolir</option>
          )}
        </select>
        {showReconfigureHint && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Perubahan mode diterapkan ke router saat Reconfigurasi Mikrotik
          </p>
        )}
      </div>

      {mode === "REDIRECT" && (
        <div>
          <label htmlFor="mikrotik-isolir-url" className={LABEL_CLASS}>
            URL halaman isolir
          </label>
          <input
            id="mikrotik-isolir-url"
            type="text"
            required
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="mydomain.com/expired.html"
            className={INPUT_CLASS}
          />
        </div>
      )}
    </div>
  );
}
