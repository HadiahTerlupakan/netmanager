"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {mode === "create"
              ? "Tambah Accel-PPP Server"
              : "Edit Accel-PPP Server"}
          </h1>
          <p className="text-sm text-slate-500">
            Kredensial RADIUS &amp; CLI accel-ppp.
          </p>
        </div>
        <Link
          href="/admin/network/accel-ppp"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Kembali
        </Link>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Field label="Nama" required>
        <input
          required
          type="text"
          value={state.name}
          onChange={(e) => update("name", e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="IP / Hostname" required>
          <input
            required
            type="text"
            value={state.ipAddress}
            onChange={(e) => update("ipAddress", e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label="NAS Identifier (opsional)">
          <input
            type="text"
            value={state.nasIdentifier}
            onChange={(e) => update("nasIdentifier", e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
      </div>

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
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Auth Port">
          <input
            type="number"
            value={state.authPort}
            onChange={(e) => update("authPort", Number(e.target.value))}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label="Acct Port">
          <input
            type="number"
            value={state.acctPort}
            onChange={(e) => update("acctPort", Number(e.target.value))}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label="CoA Port">
          <input
            type="number"
            value={state.coaPort}
            onChange={(e) => update("coaPort", Number(e.target.value))}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="CLI Host" required>
          <input
            required
            type="text"
            value={state.cliHost}
            onChange={(e) => update("cliHost", e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label="CLI Port">
          <input
            type="number"
            value={state.cliPort}
            onChange={(e) => update("cliPort", Number(e.target.value))}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
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
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono"
        />
      </Field>

      <Field label="Deskripsi (opsional)">
        <textarea
          rows={2}
          value={state.description}
          onChange={(e) => update("description", e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Menyimpan…" : mode === "create" ? "Buat" : "Simpan"}
        </button>
        <Link
          href="/admin/network/accel-ppp"
          className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
        >
          Batal
        </Link>
      </div>
    </form>
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
      <span className="mb-1 block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
