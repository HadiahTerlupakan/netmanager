"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

export default function OnuDetailClient({ id }: { id: string }) {
  const [onu, setOnu] = useState<OnuDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/olt/onu/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setOnu(json.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-gray-500">Memuat...</div>;
  if (!onu) return <div className="text-red-500">ONU tidak ditemukan</div>;

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    REGISTERED: "bg-blue-100 text-blue-800",
    UNREGISTERED: "bg-gray-100 text-gray-800",
    OFFLINE: "bg-red-100 text-red-800",
    DISABLED: "bg-yellow-100 text-yellow-800",
    LOS: "bg-red-200 text-red-900",
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/olt/onu"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Kembali
        </Link>
        <h1 className="text-2xl font-bold mt-1 font-mono">
          {onu.serialNumber}
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Status</h3>
            <p className="mt-1">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[onu.status] ?? ""}`}
              >
                {onu.status}
              </span>
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">
              PON Port : Index
            </h3>
            <p className="mt-1 font-mono">
              {onu.ponPort} : {onu.onuIndex}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">RX Power</h3>
            <p className="mt-1">
              {onu.rxPower != null ? `${onu.rxPower} dBm` : "-"}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">TX Power</h3>
            <p className="mt-1">
              {onu.txPower != null ? `${onu.txPower} dBm` : "-"}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">VLAN</h3>
            <p className="mt-1">{onu.vlanId ?? "-"}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">
              Bandwidth Profile
            </h3>
            <p className="mt-1">{onu.bandwidthProfile ?? "-"}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Pelanggan</h3>
            <p className="mt-1">{onu.pelangganId ?? "Belum di-assign"}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Registered At</h3>
            <p className="mt-1 text-sm">
              {onu.registeredAt
                ? new Date(onu.registeredAt).toLocaleString("id-ID")
                : "-"}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Last Seen</h3>
            <p className="mt-1 text-sm">
              {onu.lastSeen
                ? new Date(onu.lastSeen).toLocaleString("id-ID")
                : "-"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
