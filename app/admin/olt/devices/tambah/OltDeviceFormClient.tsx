"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OltVendor = "ZTE" | "HSGQ" | "HIOSO" | "CDATA";

export default function OltDeviceFormClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vendor, setVendor] = useState<OltVendor>("ZTE");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name: formData.get("name"),
      vendor: formData.get("vendor"),
      model: formData.get("model"),
      ipAddress: formData.get("ipAddress"),
      snmpCommunity: formData.get("snmpCommunity") || undefined,
      snmpPort: Number(formData.get("snmpPort")) || undefined,
      totalPonPorts: Number(formData.get("totalPonPorts")),
      location: formData.get("location") || undefined,
    };

    if (vendor === "ZTE") {
      body.telnetPort = Number(formData.get("telnetPort")) || undefined;
      body.telnetUser = formData.get("telnetUser") || undefined;
      body.telnetPass = formData.get("telnetPass") || undefined;
    }

    try {
      const res = await fetch("/api/olt/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Gagal menambah OLT");
        return;
      }

      router.push("/admin/olt/devices");
    } catch {
      setError("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Tambah OLT Baru</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama OLT *
            </label>
            <input
              name="name"
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="OLT Cluster A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor *
            </label>
            <select
              name="vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value as OltVendor)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="ZTE">ZTE</option>
              <option value="HSGQ">HSGQ</option>
              <option value="HIOSO">Hioso</option>
              <option value="CDATA">C-Data</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model *
            </label>
            <input
              name="model"
              required
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="C320"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              IP Address *
            </label>
            <input
              name="ipAddress"
              required
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="192.168.1.1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SNMP Community
            </label>
            <input
              name="snmpCommunity"
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="public"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SNMP Port
            </label>
            <input
              name="snmpPort"
              type="number"
              defaultValue={161}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total PON Ports *
            </label>
            <input
              name="totalPonPorts"
              type="number"
              required
              min={1}
              max={128}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="16"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lokasi
            </label>
            <input
              name="location"
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Gedung A, Lantai 2"
            />
          </div>
        </div>

        {vendor === "ZTE" && (
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Telnet Configuration (ZTE)
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telnet Port
                </label>
                <input
                  name="telnetPort"
                  type="number"
                  defaultValue={23}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  name="telnetUser"
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="admin"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  name="telnetPass"
                  type="password"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}
