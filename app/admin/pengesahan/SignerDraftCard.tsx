"use client";

import { HiOutlineDevicePhoneMobile, HiOutlineTrash } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import SignerEmployeePicker, {
  type SignerEmployeeOption,
} from "./SignerEmployeePicker";

/**
 * Satu penanda tangan di formulir pembuatan surat: karyawan internal yang
 * dipilih dari daftar (tanda tangan di aplikasi), atau pihak luar yang diisi
 * manual (menerima tautan lewat WhatsApp/email).
 */

export interface SignerDraft {
  /** Terisi bila karyawan internal; kosong untuk pihak luar. */
  userId?: string;
  name: string;
  role: string;
  email: string;
  phone: string;
}

export const EMPTY_SIGNER: SignerDraft = {
  name: "",
  role: "",
  email: "",
  phone: "",
};

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white";

/** Ubah karyawan terpilih menjadi draf penanda tangan internal. */
export function toInternalSignerDraft(option: SignerEmployeeOption): SignerDraft {
  return {
    userId: option.userId,
    name: option.name,
    role: option.role ?? "",
    email: option.email,
    phone: option.phone ?? "",
  };
}

export default function SignerDraftCard({
  signer,
  excludedUserIds,
  isRemovable,
  onChange,
  onRemove,
}: {
  signer: SignerDraft;
  excludedUserIds: string[];
  isRemovable: boolean;
  onChange: (next: SignerDraft) => void;
  onRemove: () => void;
}) {
  const update = (patch: Partial<SignerDraft>) => onChange({ ...signer, ...patch });

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      {signer.userId ? (
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{signer.name}</p>
            <p className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
              <HiOutlineDevicePhoneMobile className="h-3.5 w-3.5" />
              Karyawan — tanda tangan lewat aplikasi mobile
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...EMPTY_SIGNER })}>
            Ganti
          </Button>
        </div>
      ) : (
        <>
          <SignerEmployeePicker
            excludedUserIds={excludedUserIds}
            onSelect={(option) => onChange(toInternalSignerDraft(option))}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Atau isi manual untuk pihak luar (menerima tautan lewat WhatsApp/email):
          </p>
          <input
            type="text"
            value={signer.name}
            onChange={(event) => update({ name: event.target.value })}
            className={INPUT_CLASS}
            placeholder="Nama lengkap"
          />
        </>
      )}

      <input
        type="text"
        value={signer.role}
        onChange={(event) => update({ role: event.target.value })}
        className={INPUT_CLASS}
        placeholder="Jabatan (dicetak di bawah tanda tangan)"
      />

      {!signer.userId && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="tel"
            value={signer.phone}
            onChange={(event) => update({ phone: event.target.value })}
            className={INPUT_CLASS}
            placeholder="Nomor WhatsApp"
          />
          <input
            type="email"
            value={signer.email}
            onChange={(event) => update({ email: event.target.value })}
            className={INPUT_CLASS}
            placeholder="Email"
          />
        </div>
      )}

      {isRemovable && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-red-600 dark:text-red-400"
        >
          <HiOutlineTrash />
          Hapus penanda tangan
        </Button>
      )}
    </div>
  );
}
