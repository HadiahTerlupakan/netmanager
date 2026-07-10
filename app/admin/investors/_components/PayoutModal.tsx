"use client";

import { Modal, ModalFooter } from "@/components/ui/Modal";

export interface PayoutFormValues {
  amount: string;
  date: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  reference: string;
  notes: string;
}

interface PayoutModalProps {
  isOpen: boolean;
  saving: boolean;
  form: PayoutFormValues;
  onChange: (form: PayoutFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function PayoutModal({
  isOpen,
  saving,
  form,
  onChange,
  onClose,
  onSubmit,
}: PayoutModalProps) {
  const set = (key: keyof PayoutFormValues, value: string) =>
    onChange({ ...form, [key]: value });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pencatatan Payout Investor"
      size="md"
    >
      <div className="space-y-4 py-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nominal Payout (Rp) *
          </label>
          <input
            type="number"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tanggal Payout *
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bank Tujuan
            </label>
            <input
              type="text"
              value={form.bankName}
              onChange={(e) => set("bankName", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              placeholder="BCA / Mandiri"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              No Rekening
            </label>
            <input
              type="text"
              value={form.accountNumber}
              onChange={(e) => set("accountNumber", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nama Pemilik Rekening *
          </label>
          <input
            type="text"
            value={form.accountName}
            onChange={(e) => set("accountName", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            placeholder="Nama sesuai di buku tabungan"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Catatan Tambahan
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            rows={2}
          />
        </div>
      </div>
      <ModalFooter>
        <button
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          Batal
        </button>
        <button
          onClick={onSubmit}
          disabled={saving}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          {saving ? "Menyimpan..." : "Simpan Payout"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
