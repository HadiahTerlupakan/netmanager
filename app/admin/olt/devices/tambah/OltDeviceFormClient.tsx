"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type OltVendor = "ZTE" | "HSGQ" | "HIOSO" | "CDATA";

const VENDOR_OPTIONS: Array<{
  value: OltVendor;
  label: string;
  disabled: boolean;
}> = [
  { value: "ZTE", label: "ZTE", disabled: false },
  { value: "HSGQ", label: "HSGQ (Coming soon)", disabled: true },
  { value: "HIOSO", label: "Hioso (Coming soon)", disabled: true },
  { value: "CDATA", label: "C-Data (Coming soon)", disabled: true },
];

export default function OltDeviceFormClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vendor, setVendor] = useState<OltVendor>("ZTE");

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
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
      body.telnetEnablePass = formData.get("telnetEnablePass") || undefined;
      body.defaultSlotFrame =
        Number(formData.get("defaultSlotFrame")) || undefined;
      body.defaultSlot = Number(formData.get("defaultSlot")) || undefined;
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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link
          href="/admin/olt/devices"
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          &larr; Kembali ke daftar
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
          Tambah OLT Baru
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Daftarkan perangkat OLT baru ke dalam sistem
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Form Card */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informasi Perangkat</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nama OLT *
                </label>
                <input
                  name="name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="OLT Cluster A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Vendor *
                </label>
                <select
                  name="vendor"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value as OltVendor)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {VENDOR_OPTIONS.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      disabled={opt.disabled}
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Model *
                </label>
                <input
                  name="model"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="C320"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  IP Address *
                </label>
                <input
                  name="ipAddress"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="192.168.1.1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SNMP Community
                </label>
                <input
                  name="snmpCommunity"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="public"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SNMP Port
                </label>
                <input
                  name="snmpPort"
                  type="number"
                  defaultValue={161}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Total PON Ports *
                </label>
                <input
                  name="totalPonPorts"
                  type="number"
                  required
                  min={1}
                  max={128}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="16"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lokasi
                </label>
                <input
                  name="location"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Gedung A, Lantai 2"
                />
              </div>
            </div>

            {vendor === "ZTE" && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Telnet Configuration (ZTE)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Telnet Port
                    </label>
                    <input
                      name="telnetPort"
                      type="number"
                      defaultValue={23}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Username
                    </label>
                    <input
                      name="telnetUser"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="admin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password
                    </label>
                    <input
                      name="telnetPass"
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Enable Password
                    </label>
                    <input
                      name="telnetEnablePass"
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Kosongkan jika sama dengan password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Default Slot Frame
                    </label>
                    <input
                      name="defaultSlotFrame"
                      type="number"
                      min={1}
                      max={20}
                      defaultValue={1}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Default Slot
                    </label>
                    <input
                      name="defaultSlot"
                      type="number"
                      min={1}
                      max={20}
                      defaultValue={1}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Slot frame &amp; slot menentukan posisi GPON line card pada
                  chassis (mis. C320 stand-alone biasanya 1/1, C300 multi-slot
                  pakai 1/2 atau 1/3 sesuai card).
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="submit" variant="default" loading={loading}>
                Simpan
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
