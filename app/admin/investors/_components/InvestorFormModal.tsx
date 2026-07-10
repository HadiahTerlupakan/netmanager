"use client";

import { Modal, ModalFooter } from "@/components/ui/Modal";

export interface InvestorFormValues {
  username: string;
  password: string;
  namaLengkap: string;
  email: string;
  noTelp: string;
  perusahaan: string;
}

interface InvestorFormModalProps {
  isOpen: boolean;
  isEdit?: boolean;
  saving: boolean;
  form: InvestorFormValues;
  onChange: (form: InvestorFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function InvestorFormModal({
  isOpen,
  isEdit = false,
  saving,
  form,
  onChange,
  onClose,
  onSubmit,
}: InvestorFormModalProps) {
  const set = (key: keyof InvestorFormValues, value: string) =>
    onChange({ ...form, [key]: value });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Investor" : "Tambah Investor Baru"}
      size="lg"
    >
      {isEdit && (
        <div className="mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kosongkan password jika tidak ingin mengubahnya.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Username *
          </label>
          <input
            type="text"
            value={form.username}
            onChange={(e) =>
              set("username", e.target.value.toLowerCase().replace(/\s/g, ""))
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="investor1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Password {!isEdit && "*"}
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nama Lengkap / PIC *
          </label>
          <input
            type="text"
            value={form.namaLengkap}
            onChange={(e) => set("namaLengkap", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Nama lengkap"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Institusi / Perusahaan
          </label>
          <input
            type="text"
            value={form.perusahaan}
            onChange={(e) => set("perusahaan", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="PT Investor Kapital"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="email@contoh.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            No. Handphone
          </label>
          <input
            type="text"
            value={form.noTelp}
            onChange={(e) => set("noTelp", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="08xxxxxxxxxx"
          />
        </div>
      </div>
      <ModalFooter>
        <button
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Batal
        </button>
        <button
          onClick={onSubmit}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Simpan"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
