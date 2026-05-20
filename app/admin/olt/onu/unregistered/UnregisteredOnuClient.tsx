"use client";

import { useState, useEffect, useReducer } from "react";

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
  const [loading, setLoading] = useState(true);
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
    fetch(`/api/olt/onu/unregistered?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setOnus(json.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOlt, refreshKey]);

  const handleScan = async (oltId: string) => {
    setScanning(oltId);
    try {
      await fetch(`/api/olt/devices/${oltId}/scan`, { method: "POST" });
      setLoading(true);
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
        setLoading(true);
        refresh();
      }
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ONU Unregistered</h1>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter OLT
          </label>
          <select
            value={selectedOlt}
            onChange={(e) => setSelectedOlt(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">Semua OLT</option>
            {olts.map((olt) => (
              <option key={olt.id} value={olt.id}>
                {olt.name} ({olt.vendor})
              </option>
            ))}
          </select>
        </div>
        {selectedOlt && (
          <button
            onClick={() => handleScan(selectedOlt)}
            disabled={!!scanning}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {scanning ? "Scanning..." : "Scan OLT"}
          </button>
        )}
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cari by Serial Number
          </label>
          <input
            type="text"
            value={searchSn}
            onChange={(e) => setSearchSn(e.target.value)}
            placeholder="Masukkan SN ONU..."
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={!searchSn || !selectedOlt}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Cari
        </button>
      </div>

      {searchResult && (
        <div
          className={`p-3 rounded-lg ${searchResult.found ? "bg-green-50 text-green-800" : "bg-yellow-50 text-yellow-800"}`}
        >
          {searchResult.found
            ? `ONU ditemukan: ${JSON.stringify(searchResult.onu)}`
            : "ONU tidak ditemukan di OLT"}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Serial Number
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                OLT
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                PON Port
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Last Seen
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Memuat...
                </td>
              </tr>
            ) : onus.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Tidak ada ONU unregistered
                </td>
              </tr>
            ) : (
              onus.map((onu) => (
                <tr key={onu.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    {onu.serialNumber}
                  </td>
                  <td className="px-4 py-3 text-xs">{onu.olt?.name ?? "-"}</td>
                  <td className="px-4 py-3">{onu.ponPort}</td>
                  <td className="px-4 py-3 text-xs">
                    {onu.lastSeen
                      ? new Date(onu.lastSeen).toLocaleString("id-ID")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setRegisterModal(onu)}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Register
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {registerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-bold mb-4">Register ONU</h3>
            <p className="text-sm text-gray-600 mb-4">
              SN:{" "}
              <span className="font-mono">{registerModal.serialNumber}</span>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              PON Port: {registerModal.ponPort}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleRegister(registerModal)}
                disabled={registering}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {registering ? "Registering..." : "Confirm Register"}
              </button>
              <button
                onClick={() => setRegisterModal(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
