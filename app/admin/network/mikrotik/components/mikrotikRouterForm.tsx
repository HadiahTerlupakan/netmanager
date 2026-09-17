import Link from "next/link";

type PppConnectionMode = "RADIUS" | "MIKROTIK_API";

export type MikrotikRouterFormData = {
  name: string;
  ipAddress: string;
  timezone: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
  isolirUrl: string;
  description: string;
};

type MikrotikRouterFormProps = {
  title: string;
  pppConnectionMode: PppConnectionMode;
  formData: MikrotikRouterFormData;
  onChange: (
    field: keyof MikrotikRouterFormData,
    value: string | number,
  ) => void;
  onSubmit: (event: React.SubmitEvent) => void;
  onTestClick: () => void;
  isSubmitting: boolean;
  submitLabel: string;
  submitDisabled?: boolean;
  submitDisabledTitle?: string;
  cancelHref: string;
};

const TIMEZONE_OPTIONS = [
  { value: "+07:00 Asia/Jakarta", label: "+07:00 Asia/Jakarta" },
  { value: "+08:00 Asia/Makassar", label: "+08:00 Asia/Makassar" },
  { value: "+09:00 Asia/Jayapura", label: "+09:00 Asia/Jayapura" },
];

export function MikrotikRouterForm({
  title,
  pppConnectionMode,
  formData,
  onChange,
  onSubmit,
  onTestClick,
  isSubmitting,
  submitLabel,
  submitDisabled,
  submitDisabledTitle,
  cancelHref,
}: MikrotikRouterFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6"
    >
      <div>
        <label
          htmlFor="mikrotik-name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          ! Nama Router
        </label>
        <input
          id="mikrotik-name"
          type="text"
          value={formData.name}
          onChange={(event) => onChange("name", event.target.value)}
          required
          placeholder="Masukkan nama router"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="mikrotik-timezone"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          ! Zona Waktu
        </label>
        <select
          id="mikrotik-timezone"
          value={formData.timezone}
          onChange={(event) => onChange("timezone", event.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TIMEZONE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="mikrotik-ip-address"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          ! IP Router
        </label>
        <input
          id="mikrotik-ip-address"
          type="text"
          value={formData.ipAddress}
          onChange={(event) => onChange("ipAddress", event.target.value)}
          required
          placeholder="Masukkan IP Address atau domain"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="mikrotik-api-port"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          ! Port API
        </label>
        <input
          id="mikrotik-api-port"
          type="number"
          value={formData.apiPort}
          onChange={(event) =>
            onChange("apiPort", parseInt(event.target.value, 10) || 8728)
          }
          required
          placeholder="8728"
          min="1"
          max="65535"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="mikrotik-api-username"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          ! Username API
        </label>
        <input
          id="mikrotik-api-username"
          type="text"
          value={formData.apiUsername}
          onChange={(event) => onChange("apiUsername", event.target.value)}
          required
          placeholder="Username API"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="mikrotik-api-password"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          ! Password API
        </label>
        <input
          id="mikrotik-api-password"
          type="password"
          value={formData.apiPassword}
          onChange={(event) => onChange("apiPassword", event.target.value)}
          required
          placeholder="Password API"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="mikrotik-isolir-url"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          URL Info Isolir (Optional)
        </label>
        <input
          id="mikrotik-isolir-url"
          type="text"
          value={formData.isolirUrl}
          onChange={(event) => onChange("isolirUrl", event.target.value)}
          placeholder="mydomain.com/expired.html"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          PATH URL LENGKAP TANPA HTTP:// ATAU HTTPS://
        </p>
        <ul className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
          <li>
            FITUR INI DIGUNAKAN UNTUK MENGALIHKAN AKSES PELANGGAN PPPOE YANG
            TERISOLIR
          </li>
          <li>
            PASTIKAN FILE HTML INFORMASI ISOLIR SUDAH ADA DAN BISA DIAKSES OLEH
            MIKROTIK
          </li>
          <li>
            SETELAH FORM INI DISIMPAN, WEB PROXY MIKROTIK HARUS DIENABLE SECARA
            MANUAL
          </li>
        </ul>
      </div>

      <div>
        <label
          htmlFor="mikrotik-description"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Deskripsi
        </label>
        <textarea
          id="mikrotik-description"
          value={formData.description}
          onChange={(event) => onChange("description", event.target.value)}
          placeholder="Deskripsi"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-transparent pb-1">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {title} {pppConnectionMode === "RADIUS" && "[NAS]"}
        </h2>
      </div>

      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting || submitDisabled}
          title={submitDisabledTitle}
          className="px-6 py-2 bg-blue-600 dark:bg-blue-500 dark:bg-blue-400 text-white text-sm font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-white">
            {isSubmitting ? "Menyimpan..." : submitLabel}
          </span>
        </button>
        <button
          type="button"
          onClick={onTestClick}
          className="px-6 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          Tes Koneksi
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-400">Or</span>
        <Link
          href={cancelHref}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Batal
        </Link>
      </div>
    </form>
  );
}
