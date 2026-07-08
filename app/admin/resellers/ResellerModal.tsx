"use client";

import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import type { ResellerForm } from "./types";

type ResellerModalProps = {
  readonly isOpen: boolean;
  readonly isEditing: boolean;
  readonly saving: boolean;
  readonly form: ResellerForm;
  readonly onClose: () => void;
  readonly onSave: () => void;
  readonly onChange: (form: ResellerForm) => void;
};

export function ResellerModal({
  isOpen,
  isEditing,
  saving,
  form,
  onClose,
  onSave,
  onChange,
}: ResellerModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Reseller" : "Tambah Reseller"}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <input
          className="rounded-xl border px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
          placeholder="Kode"
          value={form.code}
          onChange={(event) => onChange({ ...form, code: event.target.value })}
        />
        <input
          className="rounded-xl border px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
          placeholder="Nama"
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
        <input
          className="rounded-xl border px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
          placeholder="Email"
          value={form.email}
          onChange={(event) => onChange({ ...form, email: event.target.value })}
        />
        <input
          className="rounded-xl border px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
          placeholder="Telepon"
          value={form.phone}
          onChange={(event) => onChange({ ...form, phone: event.target.value })}
        />
        <select
          className="rounded-xl border px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
          value={form.status}
          onChange={(event) =>
            onChange({
              ...form,
              status: event.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE",
            })
          }
        >
          <option value="ACTIVE">Aktif</option>
          <option value="INACTIVE">Nonaktif</option>
        </select>
        <input
          className="rounded-xl border px-4 py-2 dark:border-gray-600 dark:bg-gray-700"
          placeholder="Catatan"
          value={form.notes}
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
        />
        <textarea
          className="rounded-xl border px-4 py-2 sm:col-span-2 dark:border-gray-600 dark:bg-gray-700"
          placeholder="Alamat"
          value={form.address}
          onChange={(event) =>
            onChange({ ...form, address: event.target.value })
          }
        />
      </div>
      <ModalFooter className="-mx-5 -mb-5 mt-6 sm:-mx-6 sm:-mb-6">
        <Button variant="ghost" onClick={onClose}>
          Batal
        </Button>
        <Button onClick={onSave} disabled={saving}>
          Simpan
        </Button>
      </ModalFooter>
    </Modal>
  );
}
