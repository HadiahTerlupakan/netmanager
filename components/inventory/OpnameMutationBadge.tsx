import { FiClipboard } from "react-icons/fi";

const OPNAME_MUTATION_TOOLTIP =
  "Dicatat otomatis oleh stock opname. Koreksi lewat Riwayat Opname.";

/** Apakah baris barang masuk/keluar ini dicatat oleh stock opname. */
export function isOpnameMutation(row: { opnameId?: string | null }): boolean {
  return Boolean(row.opnameId);
}

/** Lencana kecil penanda barang masuk/keluar hasil stock opname. */
export function OpnameMutationBadge() {
  return (
    <span
      title={OPNAME_MUTATION_TOOLTIP}
      className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300"
    >
      <FiClipboard className="mr-1" aria-hidden="true" /> Opname
    </span>
  );
}
