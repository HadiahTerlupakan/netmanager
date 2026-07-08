"use client";

import {
  HiOutlineEye,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineWallet,
} from "react-icons/hi2";
import type { Mitra } from "./types";

export interface MitraActionHandlers {
  readonly onEdit: (mitra: Mitra) => void;
  readonly onWallet: (mitra: Mitra) => void;
  readonly onDelete: (mitraId: string) => void;
  readonly onRequestFaceVerification: (mitraId: string) => void;
  readonly canUpdate: boolean;
  readonly canDelete: boolean;
}

export interface MitraTableActionsProps {
  readonly mitra: Mitra;
  readonly handlers: MitraActionHandlers;
}

export function MitraTableActions({ mitra, handlers }: MitraTableActionsProps) {
  return (
    <>
      <button
        onClick={() => (window.location.href = `/admin/mitra/${mitra.id}`)}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Lihat Detail"
      >
        <HiOutlineEye className="w-4 h-4" />
      </button>
      <button
        onClick={() => handlers.onRequestFaceVerification(mitra.id)}
        className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors ${mitra.requiresFaceVerification ? "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600" : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400"}`}
        title={
          mitra.requiresFaceVerification
            ? "Sedang menunggu verifikasi wajah"
            : "Minta Verifikasi Wajah"
        }
        disabled={mitra.requiresFaceVerification}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
      <button
        onClick={() => window.open(`/mitra-id/${mitra.id}`, "_blank")}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
        title="Lihat/Print ID Card Resmi"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
          />
        </svg>
      </button>
      <button
        onClick={() => handlers.onWallet(mitra)}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
        title="Lihat Wallet"
      >
        <HiOutlineWallet className="w-4 h-4" />
      </button>
      {handlers.canUpdate && (
        <button
          onClick={() => handlers.onEdit(mitra)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
          title="Edit"
        >
          <HiOutlinePencilSquare className="w-4 h-4" />
        </button>
      )}
      {handlers.canDelete && (
        <button
          onClick={() => handlers.onDelete(mitra.id)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
          title="Nonaktifkan"
        >
          <HiOutlineTrash className="w-4 h-4" />
        </button>
      )}
    </>
  );
}
