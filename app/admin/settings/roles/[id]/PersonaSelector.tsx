import {
  DESKRIPSI_PERSONA_KARYAWAN,
  LABEL_PERSONA_KARYAWAN,
  PERSONA_KARYAWAN,
  type PersonaKaryawan,
} from "@/modules/roles/client";

interface PersonaSelectorProps {
  value: PersonaKaryawan;
  onChange: (persona: PersonaKaryawan) => void;
  hasMobileAccess: boolean;
  /** Izin yang dicentang menandai kepala sales (rencana kunjungan lingkup tim). */
  isKepalaSales?: boolean;
}

/** Persona yang lazim dipasangkan dengan role kepala sales. */
const PERSONA_KEPALA_SALES: PersonaKaryawan = "SALES";

/** Pilihan persona role: kerangka tampilan (Beranda & tab) aplikasi mobile. */
export function PersonaSelector({
  value,
  onChange,
  hasMobileAccess,
  isKepalaSales = false,
}: PersonaSelectorProps) {
  const isSaranSalesTampil = isKepalaSales && value !== PERSONA_KEPALA_SALES;
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <h2 className="text-lg font-semibold mb-1 text-gray-700 dark:text-gray-200">
        Tampilan aplikasi mobile (persona)
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Persona menentukan Beranda dan tab aplikasi mobile; permission tetap
        menentukan fitur apa saja yang muncul di dalamnya.
        {!hasMobileAccess &&
          " Hanya berlaku bila Akses Mobile App diaktifkan."}
      </p>
      {isSaranSalesTampil && (
        <p
          role="note"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
        >
          Role ini bisa menugaskan rencana kunjungan (kepala sales). Biasanya
          dipasangkan dengan tampilan {LABEL_PERSONA_KARYAWAN[PERSONA_KEPALA_SALES]}.
        </p>
      )}
      <div
        role="radiogroup"
        aria-label="Tampilan aplikasi mobile (persona)"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        {PERSONA_KARYAWAN.map((persona) => {
          const isSelected = value === persona;
          return (
            <label
              key={persona}
              className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                isSelected
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700"
                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              <input
                type="radio"
                name="persona"
                value={persona}
                checked={isSelected}
                onChange={() => onChange(persona)}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 mt-1"
              />
              <div>
                <span className="block font-medium text-gray-800 dark:text-white">
                  {LABEL_PERSONA_KARYAWAN[persona]}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {DESKRIPSI_PERSONA_KARYAWAN[persona]}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
