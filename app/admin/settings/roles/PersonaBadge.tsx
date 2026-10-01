import {
  LABEL_PERSONA_KARYAWAN,
  type PersonaKaryawan,
} from "@/modules/roles/client";

const WARNA_BADGE_PERSONA: Record<PersonaKaryawan, string> = {
  STAFF: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  TEKNISI: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  SALES:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  FINANCE:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  DIREKTUR:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

/** Badge ringkas persona (tampilan aplikasi mobile) sebuah role. */
export function PersonaBadge({ persona }: { persona: PersonaKaryawan }) {
  return (
    <span
      className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${WARNA_BADGE_PERSONA[persona]}`}
    >
      {LABEL_PERSONA_KARYAWAN[persona]}
    </span>
  );
}
