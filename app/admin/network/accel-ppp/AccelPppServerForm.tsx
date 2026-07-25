"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HiArrowLeft } from "react-icons/hi2";
import { accelPppMutations, type AccelPppServerListItem } from "./hooks";

interface FormState {
  name: string;
  ipAddress: string;
  description: string;
  nasIdentifier: string;
  radiusSecret: string;
  authPort: number;
  acctPort: number;
  coaPort: number;
  cliHost: string;
  cliPort: number;
  cliPassword: string;
  siteId: string;
}

const DEFAULT_STATE: FormState = {
  name: "",
  ipAddress: "",
  description: "",
  nasIdentifier: "",
  radiusSecret: "",
  authPort: 1812,
  acctPort: 1813,
  coaPort: 3799,
  cliHost: "",
  cliPort: 2001,
  cliPassword: "",
  siteId: "",
};

export interface AccelPppServerFormProps {
  mode: "create" | "edit";
  initial?: AccelPppServerListItem;
}

export default function AccelPppServerForm({
  mode,
  initial,
}: AccelPppServerFormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({
    ...DEFAULT_STATE,
    ...(initial && {
      name: initial.name,
      ipAddress: initial.ipAddress,
      description: initial.description ?? "",
      nasIdentifier: initial.nasIdentifier ?? "",
      authPort: initial.authPort,
      acctPort: initial.acctPort,
      coaPort: initial.coaPort,
      cliHost: initial.cliHost,
      cliPort: initial.cliPort,
      siteId: initial.siteId ?? "",
    }),
    radiusSecret: "",
    cliPassword: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: state.name.trim(),
      ipAddress: state.ipAddress.trim(),
      description: state.description.trim() || null,
      nasIdentifier: state.nasIdentifier.trim() || null,
      authPort: state.authPort,
      acctPort: state.acctPort,
      coaPort: state.coaPort,
      cliHost: state.cliHost.trim(),
      cliPort: state.cliPort,
      siteId: state.siteId.trim() || null,
    };

    if (state.radiusSecret) {
      payload.radiusSecret = state.radiusSecret;
    } else if (mode === "create") {
      setSubmitting(false);
      setError("RADIUS secret wajib diisi");
      return;
    }

    if (state.cliPassword) {
      payload.cliPassword = state.cliPassword;
    }

    try {
      if (mode === "create") {
        const result = await accelPppMutations.create(payload);
        router.push(`/admin/network/accel-ppp/${result.id}`);
      } else if (initial) {
        await accelPppMutations.update(initial.id, payload);
        router.push(`/admin/network/accel-ppp/${initial.id}`);
      }
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/network/accel-ppp"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Kembali"
          >
            <HiArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {mode === "create"
                ? "Tambah Accel-PPP Server"
                : "Edit Accel-PPP Server"}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Kredensial RADIUS &amp; CLI accel-ppp.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <Section title="Identitas Server">
          <Field label="Nama Server" required>
            <input
              required
              type="text"
              value={state.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Misal: accel-ppp-edge1"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="IP / Hostname" required>
              <input
                required
                type="text"
                value={state.ipAddress}
                onChange={(e) => update("ipAddress", e.target.value)}
                placeholder="10.10.0.1"
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field label="NAS Identifier (opsional)">
              <input
                type="text"
                value={state.nasIdentifier}
                onChange={(e) => update("nasIdentifier", e.target.value)}
                placeholder="default = IP address"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Deskripsi (opsional)">
            <textarea
              rows={2}
              value={state.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Catatan server"
              className={inputClass}
            />
          </Field>
        </Section>

        <Section
          title="Kredensial RADIUS"
          description="Shared secret untuk auth dari accel-ppp ke FreeRADIUS."
        >
          <Field
            label={
              mode === "create"
                ? "RADIUS Secret"
                : "RADIUS Secret (kosongkan jika tidak diubah)"
            }
            required={mode === "create"}
          >
            <input
              type="password"
              value={state.radiusSecret}
              onChange={(e) => update("radiusSecret", e.target.value)}
              placeholder={
                mode === "edit" ? "•••••• (tidak diubah)" : "Min. 8 karakter"
              }
              className={`${inputClass} font-mono`}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Auth Port">
              <input
                type="number"
                value={state.authPort}
                onChange={(e) => update("authPort", Number(e.target.value))}
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field label="Acct Port">
              <input
                type="number"
                value={state.acctPort}
                onChange={(e) => update("acctPort", Number(e.target.value))}
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field label="CoA Port">
              <input
                type="number"
                value={state.coaPort}
                onChange={(e) => update("coaPort", Number(e.target.value))}
                className={`${inputClass} font-mono`}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Akses CLI accel-ppp"
          description="TCP socket untuk operasi runtime: monitor sessions, kick, show stat."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Field label="CLI Host" required>
                <input
                  required
                  type="text"
                  value={state.cliHost}
                  onChange={(e) => update("cliHost", e.target.value)}
                  placeholder="default = sama dengan IP"
                  className={`${inputClass} font-mono`}
                />
              </Field>
            </div>
            <Field label="CLI Port">
              <input
                type="number"
                value={state.cliPort}
                onChange={(e) => update("cliPort", Number(e.target.value))}
                className={`${inputClass} font-mono`}
              />
            </Field>
          </div>

          <Field
            label={
              mode === "create"
                ? "CLI Password (opsional)"
                : "CLI Password (kosongkan jika tidak diubah)"
            }
          >
            <input
              type="password"
              value={state.cliPassword}
              onChange={(e) => update("cliPassword", e.target.value)}
              placeholder={
                mode === "edit"
                  ? "•••••• (tidak diubah)"
                  : "Sesuaikan dengan accel-ppp.conf [cli] password="
              }
              className={`${inputClass} font-mono`}
            />
          </Field>
        </Section>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-end dark:border-gray-700">
          <Link
            href="/admin/network/accel-ppp"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Batal
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {submitting
              ? "Menyimpan…"
              : mode === "create"
                ? "Buat Server"
                : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
