"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import PageLoader from "@/components/ui/PageLoader";

interface OnuDetail {
  id: string;
  serialNumber: string;
  ponPort: number;
  onuIndex: number;
  status: string;
  vendor: string | null;
  model: string | null;
  rxPower: number | null;
  txPower: number | null;
  vlanId: number | null;
  bandwidthProfile: string | null;
  pelangganId: string | null;
  lastSeen: string | null;
  registeredAt: string | null;
  oltId: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800",
  REGISTERED:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  UNREGISTERED:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700",
  OFFLINE:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800",
  DISABLED:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800",
  LOS: "bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-800",
};

export default function OnuDetailClient({ id }: { id: string }) {
  const [onu, setOnu] = useState<OnuDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [opticalLoading, setOpticalLoading] = useState(false);
  const [opticalPower, setOpticalPower] = useState<{
    rxPower: number | null;
    txPower: number | null;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/olt/onu/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setOnu(json.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleAction = useCallback(
    async (action: string) => {
      setActionLoading(action);
      try {
        const res = await fetch(`/api/olt/onu/${id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          setOnu(json.data);
        }
      } finally {
        setActionLoading(null);
      }
    },
    [id],
  );

  const handleRefreshOptical = useCallback(async () => {
    setOpticalLoading(true);
    try {
      const res = await fetch(`/api/olt/onu/${id}/optical`);
      const json = await res.json();
      if (json.success) {
        setOpticalPower(json.data);
      }
    } finally {
      setOpticalLoading(false);
    }
  }, [id]);

  if (loading) {
    return <PageLoader variant="section" message="Memuat detail ONU..." />;
  }

  if (!onu) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 dark:text-red-400 font-medium">
          ONU tidak ditemukan
        </p>
        <Link href="/admin/olt/onu" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            Kembali ke Daftar ONU
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link
            href="/admin/olt/onu"
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            &larr; Kembali ke Daftar ONU
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1 font-mono">
            {onu.serialNumber}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Detail informasi dan kontrol ONU
          </p>
        </div>
        <div>
          <span
            className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[onu.status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
          >
            {onu.status}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Aksi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="success"
              size="sm"
              loading={actionLoading === "enable"}
              onClick={() => handleAction("enable")}
            >
              Enable
            </Button>
            <Button
              variant="warning"
              size="sm"
              loading={actionLoading === "disable"}
              onClick={() => handleAction("disable")}
            >
              Disable
            </Button>
            <Button
              variant="default"
              size="sm"
              loading={actionLoading === "reset"}
              onClick={() => handleAction("reset")}
            >
              Reset
            </Button>
            <Button
              variant="destructive"
              size="sm"
              loading={actionLoading === "reboot"}
              onClick={() => handleAction("reboot")}
            >
              Reboot
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ONU Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi ONU</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <InfoField
              label="PON Port : Index"
              value={`${onu.ponPort} : ${onu.onuIndex}`}
              mono
            />
            <InfoField label="Vendor" value={onu.vendor ?? "-"} />
            <InfoField label="Model" value={onu.model ?? "-"} />
            <InfoField
              label="VLAN"
              value={onu.vlanId != null ? String(onu.vlanId) : "-"}
            />
            <InfoField
              label="Bandwidth Profile"
              value={onu.bandwidthProfile ?? "-"}
            />
            <InfoField
              label="Pelanggan"
              value={onu.pelangganId ?? "Belum di-assign"}
            />
            <InfoField
              label="Registered At"
              value={
                onu.registeredAt
                  ? new Date(onu.registeredAt).toLocaleString("id-ID")
                  : "-"
              }
            />
            <InfoField
              label="Last Seen"
              value={
                onu.lastSeen
                  ? new Date(onu.lastSeen).toLocaleString("id-ID")
                  : "-"
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Optical Power */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Optical Power</CardTitle>
          <Button
            variant="outline"
            size="sm"
            loading={opticalLoading}
            onClick={handleRefreshOptical}
          >
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <InfoField
              label="RX Power"
              value={
                (opticalPower?.rxPower ?? onu.rxPower) != null
                  ? `${opticalPower?.rxPower ?? onu.rxPower} dBm`
                  : "-"
              }
            />
            <InfoField
              label="TX Power"
              value={
                (opticalPower?.txPower ?? onu.txPower) != null
                  ? `${opticalPower?.txPower ?? onu.txPower} dBm`
                  : "-"
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Reusable info field for detail cards */
function InfoField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm text-gray-900 dark:text-white ${mono ? "font-mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
