"use client";

interface TableLoadingRowProps {
  colSpan: number;
  message?: string;
}

/** Row loading dengan spinner untuk tabel admin notifikasi. */
export function TableLoadingRow({
  colSpan,
  message = "Memuat data...",
}: TableLoadingRowProps) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-10 text-center text-gray-500 dark:text-gray-400"
      >
        <div className="flex items-center justify-center gap-2">
          <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
          {message}
        </div>
      </td>
    </tr>
  );
}

interface TableEmptyRowProps {
  colSpan: number;
  message: string;
}

/** Row empty state untuk tabel admin notifikasi. */
export function TableEmptyRow({ colSpan, message }: TableEmptyRowProps) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-10 text-center text-gray-500 dark:text-gray-400"
      >
        {message}
      </td>
    </tr>
  );
}
