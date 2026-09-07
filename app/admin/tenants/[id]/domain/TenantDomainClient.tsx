"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "react-hot-toast";
import {
  HiOutlineArrowLeft,
  HiOutlineArrowPath,
  HiOutlineGlobeAlt,
  HiOutlineNoSymbol,
  HiOutlineTrash,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import { clientLogger } from "@/lib/client-logger";

interface TenantDomainResponse {
  id: string;
  domain: string | null;
  slug: string;
  status: string;
  sslStatus: string;
  verifiedAt: string | null;
  cnameTarget: string;
  subdomain: string;
  instructions: string | null;
}

type ApiEnvelope =
  | { data?: TenantDomainResponse | null }
  | TenantDomainResponse;

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu verifikasi",
  verified: "DNS terverifikasi",
  active: "Aktif",
  failed: "Gagal",
};

const SSL_STATUS_LABEL: Record<string, string> = {
  pending: "Belum diterbitkan",
  provisioning: "Sedang diterbitkan",
  active: "Aktif",
  failed: "Gagal",
};

const STATUS_TONE: Record<string, string> = {
  active: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  verified: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  provisioning:
    "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  failed: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
};

const NEUTRAL_TONE =
  "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300";

function StatusBadge({ value, label }: { value: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_TONE[value] ?? NEUTRAL_TONE
      }`}
    >
      {label}
    </span>
  );
}

/** Ambil isi respons apa pun bentuk pembungkusnya. */
function unwrap(
  response: ApiEnvelope | undefined,
): TenantDomainResponse | null {
  if (!response) return null;
  if ("slug" in response) return response;
  return response.data ?? null;
}

export default function TenantDomainClient({ tenantId }: { tenantId: string }) {
  const { data, error, isLoading, mutate } = useApi<ApiEnvelope>(
    `/api/admin/tenants/${tenantId}/domains`,
  );
  const [domainInput, setDomainInput] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const record = unwrap(data);

  /** Jalankan satu aksi tulis lalu segarkan data. */
  const runAction = async (
    action: string,
    request: () => Promise<Response>,
    successMessage: string,
  ) => {
    setBusyAction(action);
    try {
      const response = await request();
      const body = (await response.json()) as {
        error?: string;
        data?: { verified?: boolean; reason?: string };
      };

      if (!response.ok) {
        toast.error(body.error || "Aksi gagal dijalankan");
        return;
      }

      if (body.data && body.data.verified === false) {
        toast.error(body.data.reason || "DNS belum mengarah dengan benar");
      } else {
        toast.success(successMessage);
      }

      await mutate();
    } catch (err) {
      clientLogger.error("[TenantDomain] aksi gagal:", err);
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setBusyAction(null);
    }
  };

  const handlePrepare = () =>
    runAction(
      "prepare",
      () =>
        fetch("/api/admin/tenant-domains", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId }),
        }),
      "Subdomain tenant sudah disiapkan",
    );

  const handleSaveDomain = () =>
    runAction(
      "save",
      () =>
        fetch(`/api/admin/tenants/${tenantId}/domains`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: domainInput.trim() }),
        }),
      "Domain disimpan, tinggal arahkan DNS lalu verifikasi",
    );

  const handleRemoveDomain = () =>
    runAction(
      "remove",
      () =>
        fetch(`/api/admin/tenants/${tenantId}/domains/${record?.id}`, {
          method: "DELETE",
        }),
      "Domain kustom dilepas",
    );

  const handleVerify = () =>
    runAction(
      "verify",
      () =>
        fetch(`/api/admin/tenant-domains/${record?.id}/verify`, {
          method: "POST",
        }),
      "DNS terverifikasi, sertifikat sedang diterbitkan",
    );

  const handleDisable = () =>
    runAction(
      "disable",
      () =>
        fetch(`/api/admin/tenant-domains/${record?.id}/disable`, {
          method: "POST",
        }),
      "Domain dinonaktifkan",
    );

  if (isLoading) return <PageLoader />;

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Gagal memuat konfigurasi domain tenant.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/tenants"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <HiOutlineArrowLeft className="w-4 h-4" />
          Kembali ke daftar tenant
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <HiOutlineGlobeAlt className="w-6 h-6" />
          Domain Tenant
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Subdomain bawaan dan domain milik tenant sendiri.
        </p>
      </div>

      {!record ? (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Tenant ini belum punya subdomain. Tanpa itu, tenant tidak bisa
            diakses lewat subdomain sendiri maupun memakai domain kustom.
          </p>
          <Button
            onClick={handlePrepare}
            disabled={busyAction !== null}
            className="mt-4"
          >
            Siapkan subdomain tenant
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Subdomain bawaan
            </h2>
            <p className="font-mono text-sm text-gray-900 dark:text-white">
              {record.subdomain}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Selalu aktif dan sudah memakai sertifikat utama — tidak perlu
              pengaturan DNS apa pun.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Domain kustom
              </h2>
              <div className="flex items-center gap-2">
                <StatusBadge
                  value={record.status}
                  label={`DNS: ${STATUS_LABEL[record.status] ?? record.status}`}
                />
                <StatusBadge
                  value={record.sslStatus}
                  label={`SSL: ${
                    SSL_STATUS_LABEL[record.sslStatus] ?? record.sslStatus
                  }`}
                />
              </div>
            </div>

            {record.domain ? (
              <div className="space-y-3">
                <p className="font-mono text-sm text-gray-900 dark:text-white">
                  {record.domain}
                </p>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-4 text-sm text-gray-600 dark:text-gray-300">
                  <p className="font-medium text-gray-900 dark:text-white">
                    Pengaturan DNS di sisi tenant
                  </p>
                  <p className="mt-1 font-mono text-xs">
                    CNAME {record.domain} → {record.cnameTarget}
                  </p>
                  <p className="mt-2">
                    Sertifikat diterbitkan otomatis setelah DNS terverifikasi.
                    Pemeriksaan berjalan tiap 5 menit; tombol di bawah memaksa
                    pemeriksaan sekarang.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleVerify}
                    disabled={busyAction !== null}
                    className="inline-flex items-center gap-1.5"
                  >
                    <HiOutlineArrowPath className="w-4 h-4" />
                    Verifikasi sekarang
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleDisable}
                    disabled={busyAction !== null}
                    className="inline-flex items-center gap-1.5"
                  >
                    <HiOutlineNoSymbol className="w-4 h-4" />
                    Nonaktifkan
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleRemoveDomain}
                    disabled={busyAction !== null}
                    className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400"
                  >
                    <HiOutlineTrash className="w-4 h-4" />
                    Lepas domain
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Belum ada domain kustom. Isi domain milik tenant, lalu minta
                  mereka mengarahkan CNAME ke {record.cnameTarget}.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={domainInput}
                    onChange={(event) => setDomainInput(event.target.value)}
                    placeholder="portal.domainklien.com"
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white"
                  />
                  <Button
                    onClick={handleSaveDomain}
                    disabled={busyAction !== null || domainInput.trim() === ""}
                  >
                    Simpan domain
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
