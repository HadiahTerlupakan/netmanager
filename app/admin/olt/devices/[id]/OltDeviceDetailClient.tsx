"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface OltDevice {
  id: string;
  name: string;
  vendor: string;
  model: string;
  ipAddress: string;
  snmpCommunity: string | null;
  snmpPort: number;
  telnetPort: number | null;
  telnetUser: string | null;
  totalPonPorts: number;
  location: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function OltDeviceDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [device, setDevice] = useState<OltDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/olt/devices/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setDevice(json.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/olt/devices/${id}/test-connection`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setTestResult({ success: json.data.connected, error: json.data.error });
      }
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!device || !confirm(`Hapus OLT "${device.name}"?`)) return;
    await fetch(`/api/olt/devices/${id}`, { method: "DELETE" });
    router.push("/admin/olt/devices");
  };

  if (loading) return <div className="text-gray-500">Memuat...</div>;
  if (!device) return <div className="text-red-500">OLT tidak ditemukan</div>;

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    MAINTENANCE: "bg-yellow-100 text-yellow-800",
    OFFLINE: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/olt/devices"
            className="text-sm text-blue-600 hover:underline"
          >
            &larr; Kembali ke daftar
          </Link>
          <h1 className="text-2xl font-bold mt-1">{device.name}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Hapus
          </button>
        </div>
      </div>

      {testResult && (
        <div
          className={`p-3 rounded-lg ${testResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
        >
          {testResult.success
            ? "Koneksi berhasil! SNMP dan Telnet OK."
            : `Koneksi gagal: ${testResult.error}`}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Vendor</h3>
            <p className="mt-1 font-medium">{device.vendor}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Model</h3>
            <p className="mt-1 font-medium">{device.model}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">IP Address</h3>
            <p className="mt-1 font-mono">{device.ipAddress}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Status</h3>
            <p className="mt-1">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[device.status] ?? ""}`}
              >
                {device.status}
              </span>
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">
              Total PON Ports
            </h3>
            <p className="mt-1 font-medium">{device.totalPonPorts}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Lokasi</h3>
            <p className="mt-1">{device.location ?? "-"}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">
              SNMP Community
            </h3>
            <p className="mt-1 font-mono text-sm">
              {device.snmpCommunity ?? "-"}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">SNMP Port</h3>
            <p className="mt-1">{device.snmpPort}</p>
          </div>
          {device.vendor === "ZTE" && (
            <>
              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  Telnet Port
                </h3>
                <p className="mt-1">{device.telnetPort ?? 23}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">
                  Telnet User
                </h3>
                <p className="mt-1">{device.telnetUser ?? "-"}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
