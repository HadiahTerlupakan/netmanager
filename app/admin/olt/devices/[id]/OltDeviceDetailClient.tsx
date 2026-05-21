"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import PageLoader from "@/components/ui/PageLoader";

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

  if (loading)
    return <PageLoader variant="section" message="Memuat detail OLT..." />;

  if (!device) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg">
        OLT tidak ditemukan
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    ACTIVE:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    MAINTENANCE:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    OFFLINE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link
            href="/admin/olt/devices"
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            &larr; Kembali ke daftar
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {device.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Detail dan konfigurasi perangkat OLT
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="success"
            onClick={handleTestConnection}
            loading={testing}
          >
            Test Connection
          </Button>
          <Link href={`/admin/olt/devices/${id}/vlan`}>
            <Button variant="outline">VLAN Config</Button>
          </Link>
          <Link href={`/admin/olt/devices/${id}/snmp-explorer`}>
            <Button variant="outline">SNMP Explorer</Button>
          </Link>
          <Button variant="destructive" onClick={handleDelete}>
            Hapus
          </Button>
        </div>
      </div>

      {/* Test Result Alert */}
      {testResult && (
        <div
          className={`p-3 rounded-lg text-sm ${
            testResult.success
              ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300"
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
          }`}
        >
          {testResult.success
            ? "Koneksi berhasil! SNMP dan Telnet OK."
            : `Koneksi gagal: ${testResult.error}`}
        </div>
      )}

      {/* Device Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi Perangkat</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Vendor
              </h3>
              <p className="mt-1 font-medium text-gray-900 dark:text-white">
                {device.vendor}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Model
              </h3>
              <p className="mt-1 font-medium text-gray-900 dark:text-white">
                {device.model}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                IP Address
              </h3>
              <p className="mt-1 font-mono text-gray-900 dark:text-white">
                {device.ipAddress}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Status
              </h3>
              <p className="mt-1">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[device.status] ?? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"}`}
                >
                  {device.status}
                </span>
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Total PON Ports
              </h3>
              <p className="mt-1 font-medium text-gray-900 dark:text-white">
                {device.totalPonPorts}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Lokasi
              </h3>
              <p className="mt-1 text-gray-900 dark:text-white">
                {device.location ?? "-"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SNMP & Telnet Config Card */}
      <Card>
        <CardHeader>
          <CardTitle>Konfigurasi Koneksi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                SNMP Community
              </h3>
              <p className="mt-1 font-mono text-sm text-gray-900 dark:text-white">
                {device.snmpCommunity ?? "-"}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                SNMP Port
              </h3>
              <p className="mt-1 text-gray-900 dark:text-white">
                {device.snmpPort}
              </p>
            </div>
            {device.vendor === "ZTE" && (
              <>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Telnet Port
                  </h3>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {device.telnetPort ?? 23}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Telnet User
                  </h3>
                  <p className="mt-1 text-gray-900 dark:text-white">
                    {device.telnetUser ?? "-"}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
