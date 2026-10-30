"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

/** Same rule as CustomerPortalService.changePassword. */
const MIN_PASSWORD_LENGTH = 6;

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#111418] focus:border-[#0d9488] focus:outline-none focus:ring-2 focus:ring-[#0d9488]/20 dark:border-gray-700 dark:bg-[#101922] dark:text-white";

function validate(next: string, confirm: string): string | null {
  if (next.length < MIN_PASSWORD_LENGTH) {
    return `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter`;
  }
  if (next !== confirm) return "Konfirmasi password tidak cocok";
  return null;
}

function PasswordField(props: {
  label: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{props.label}</span>
      <input
        type="password"
        aria-label={props.label}
        autoComplete={props.autoComplete}
        className={inputClass}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

export function ChangePasswordDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    onClose();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validate(next, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error || "Gagal mengganti password");
        return;
      }
      showToast("success", "Password berhasil diubah");
      close();
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Ganti Password" size="sm">
      <form className="space-y-4" onSubmit={submit}>
        <PasswordField
          label="Password saat ini"
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
        />
        <PasswordField
          label="Password baru"
          autoComplete="new-password"
          value={next}
          onChange={setNext}
        />
        <PasswordField
          label="Ulangi password baru"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={saving || !current || !next || !confirm}
        >
          {saving ? "Menyimpan…" : "Simpan Password"}
        </Button>
      </form>
    </Modal>
  );
}
