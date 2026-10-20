"use client";

import { HiOutlineClipboardDocument } from "react-icons/hi2";
import { copyToClipboard } from "./vpnShared";

/** Kotak perintah shell dengan tombol salin. */
export default function VpnCommandBox({ command }: { command: string }) {
  return (
    <div className="space-y-2">
      <pre className="whitespace-pre-wrap break-all rounded-lg bg-gray-900 p-3 text-xs text-green-300">
        {command}
      </pre>
      <button
        type="button"
        onClick={() => copyToClipboard(command, "Perintah disalin")}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
      >
        <HiOutlineClipboardDocument className="w-4 h-4" />
        Salin
      </button>
    </div>
  );
}
