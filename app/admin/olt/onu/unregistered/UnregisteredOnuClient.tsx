"use client";

import { useState, useEffect, useReducer, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import ResponsiveTable, { type Column } from "@/components/ui/ResponsiveTable";
import PageLoader from "@/components/ui/PageLoader";

interface UnregisteredOnu {
  id: string;
  serialNumber: string;
  ponPort: number;
  onuIndex: number;
  lastSeen: string | null;
  olt?: { name: string; vendor: string };
}

interface OltOption {
  id: string;
  name: string;
  vendor: string;
}

export default function UnregisteredOnuClient() {
  const [onus, setOnus] = useState<UnregisteredOnu[]>([]);
  const [olts, setOlts] = useState<OltOption[]>([]);
  const [loading, startTransition] = useTransition();
  const [scanning, setScanning] = useState<string | null>(null);
  const [selectedOlt, setSelectedOlt] = useState("");
  const [searchSn, setSearchSn] = useState("");
  const [searchResult, setSearchResult] = useState<{
    found: boolean;
    onu?: unknown;
  } | null>(null);
  const [registerModal, setRegisterModal] = useState<UnregisteredOnu | null>(
    null,
  );
  const [registering, setRegistering] = useState(false);
  const [refreshKey, refresh] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/olt/devices?limit=100")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setOlts(json.data.data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (selectedOlt) params.set("oltId", selectedOlt);

    startTransition(async () => {
      const res = await fetch(`/api/olt/onu/unregistered?${params}`);
      const json = await res.json();
      if (!cancelled && json.success) setOnus(json.data);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedOlt, refreshKey]);

  const handleScan = async (oltId: string) => {
    setScanning(oltId);
    try {
      await fetch(`/api/olt/devices/${oltId}/scan`, { method: "POST" });
      refresh();
    } finally {
      setScanning(null);
    }
  };

  const handleSearch = async () => {
    if (!searchSn || !selectedOlt) return;
    const res = await fetch(
      `/api/olt/onu/search?sn=${searchSn}&oltId=${selectedOlt}`,
    );
    const json = await res.json();
    if (json.success) setSearchResult(json.data);
  };

  const handleRegister = async (onu: UnregisteredOnu) => {
    setRegistering(true);
    try {
      const res = await fetch(`/api/olt/onu/${onu.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oltId: selectedOlt || undefined,
          serialNumber: onu.serialNumber,
          ponPort: onu.ponPort,
          onuIndex: onu.onuIndex || 1,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRegisterModal(null);
        refresh();
      }
    } finally {
      setRegistering(false);
    }
  };

  const columns: Column<UnregisteredOnu>[] = [
    {
      key: "serialNumber",
      header: "Serial Number",
      priority: "primary",
      render: (item) => (
        <span className="font-mono text-xs text-gray-900 dark:text-white">
          {item.serialNumber}
        </span>
      ),
    },
    {
      key: "olt",
      header: "OLT",
      priority: "secondary",
      render: (item) => (
        <span className="text-gray-700 dark:text-gray-300 text-xs">
          {item.olt?.name ?? "-"}
        </span>
      ),
    },
    {
      key: "ponPort",
      header: "PON Port",
      priority: "secondary",
      render: (item) => (
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
          {item.ponPort}
        </span>
      ),
    },
    {
      key: "lastSeen",
      header: "Last Seen",
      priority: "tertiary",
      render: (item) => (
        <span className="text-gray-600 dark:text-gray-400 text-xs">
          {item.lastSeen
            ? new Date(item.lastSeen).toLocaleString("id-ID")
            : "-"}
        </span>
      ),
    },
  ];

  if (loading && onus.length === 0) {
    return (
      <PageLoader variant="section" message="Memuat ONU unregistered..." />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            ONU Unregistered
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            ONU yang terdeteksi namun belum terdaftar di sistem
          </p>
        </div>
        {selectedOlt && (
          <Button
            variant="success"
            size="sm"
            loading={!!scanning}
            onClick={() => handleScan(selectedOlt)}
          >
            {scanning ? "Scanning..." : "Scan OLT"}
          </Button>
        )}
      </div>

      {/* Filter & Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filter & Pencarian</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter OLT
              </label>
              <select
                value={selectedOlt}
                onChange={(e) => setSelectedOlt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Semua OLT</option>
                {olts.map((olt) => (
                  <option key={olt.id} value={olt.id}>
                    {olt.name} ({olt.vendor})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cari by Serial Number
              </label>
              <input
                type="text"
                value={searchSn}
                onChange={(e) => setSearchSn(e.target.value)}
                placeholder="Masukkan SN ONU..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
            <Button
              variant="default"
              size="default"
              onClick={handleSearch}
              disabled={!searchSn || !selectedOlt}
            >
              Cari
            </Button>
          </div>

          {searchResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                searchResult.found
                  ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 border border-green-200 dark:border-green-800"
                  : "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800"
              }`}
            >
              {searchResult.found
                ? `ONU ditemukan: ${JSON.stringify(searchResult.onu)}`
                : "ONU tidak ditemukan di OLT"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={onus}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage="Tidak ada ONU unregistered"
          renderActions={(item) => (
            <Button
              variant="default"
              size="sm"
              onClick={() => setRegisterModal(item)}
            >
              Register
            </Button>
          )}
        />
      </div>

      {/* Register Modal */}
      {registerModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-96 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Register ONU
            </h3>
            <div className="space-y-2 mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Serial Number:{" "}
                <span className="font-mono text-gray-900 dark:text-white">
                  {registerModal.serialNumber}
                </span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                PON Port:{" "}
                <span className="text-gray-900 dark:text-white">
                  {registerModal.ponPort}
                </span>
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="default"
                className="flex-1"
                loading={registering}
                onClick={() => handleRegister(registerModal)}
              >
                Confirm Register
              </Button>
              <Button variant="outline" onClick={() => setRegisterModal(null)}>
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
