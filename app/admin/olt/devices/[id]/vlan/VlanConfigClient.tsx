"use client";

import { useState, useEffect, useReducer } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import PageLoader from "@/components/ui/PageLoader";
import { EmptyState } from "@/components/ui/EmptyState";

interface VlanConfig {
  id: string;
  ponPort: number | null;
  vlanId: number;
  vlanName: string | null;
  purpose: string;
}

export default function VlanConfigClient({ oltId }: { oltId: string }) {
  const [configs, setConfigs] = useState<VlanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [vlanId, setVlanId] = useState("");
  const [vlanName, setVlanName] = useState("");
  const [ponPort, setPonPort] = useState("");
  const [purpose, setPurpose] = useState("INTERNET");
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, refresh] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/olt/devices/${oltId}/vlan-config`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setConfigs(json.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [oltId, refreshKey]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vlanId) return;
    setSubmitting(true);
    try {
      await fetch(`/api/olt/devices/${oltId}/vlan-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vlanId: Number(vlanId),
          vlanName: vlanName || undefined,
          ponPort: ponPort ? Number(ponPort) : undefined,
          purpose,
        }),
      });
      setVlanId("");
      setVlanName("");
      setPonPort("");
      setLoading(true);
      refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (configId: string) => {
    if (!confirm("Hapus VLAN config ini?")) return;
    await fetch(`/api/olt/devices/${oltId}/vlan-config?configId=${configId}`, {
      method: "DELETE",
    });
    setLoading(true);
    refresh();
  };

  const columns: Column<VlanConfig>[] = [
    {
      key: "vlanId",
      header: "VLAN ID",
      priority: "primary",
      render: (cfg) => (
        <span className="font-mono text-gray-900 dark:text-white">
          {cfg.vlanId}
        </span>
      ),
    },
    {
      key: "vlanName",
      header: "Nama",
      priority: "primary",
      render: (cfg) => (
        <span className="text-gray-900 dark:text-white">
          {cfg.vlanName ?? "-"}
        </span>
      ),
    },
    {
      key: "ponPort",
      header: "PON Port",
      priority: "secondary",
      render: (cfg) => (
        <span className="text-gray-900 dark:text-white">
          {cfg.ponPort ?? "Semua"}
        </span>
      ),
    },
    {
      key: "purpose",
      header: "Purpose",
      priority: "secondary",
    },
  ];

  if (loading && configs.length === 0) {
    return <PageLoader variant="section" message="Memuat VLAN config..." />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link
          href={`/admin/olt/devices/${oltId}`}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          &larr; Kembali ke detail OLT
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
          VLAN Configuration
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Kelola konfigurasi VLAN untuk perangkat OLT ini
        </p>
      </div>

      {/* Add VLAN Form */}
      <Card>
        <CardHeader>
          <CardTitle>Tambah VLAN</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  VLAN ID *
                </label>
                <input
                  type="number"
                  value={vlanId}
                  onChange={(e) => setVlanId(e.target.value)}
                  min={1}
                  max={4094}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Nama
                </label>
                <input
                  type="text"
                  value={vlanName}
                  onChange={(e) => setVlanName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Internet VLAN"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  PON Port (kosong = semua)
                </label>
                <input
                  type="number"
                  value={ponPort}
                  onChange={(e) => setPonPort(e.target.value)}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Purpose
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="INTERNET">Internet</option>
                  <option value="IPTV">IPTV</option>
                  <option value="VOIP">VoIP</option>
                  <option value="MANAGEMENT">Management</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <Button
                type="submit"
                variant="default"
                size="sm"
                loading={submitting}
              >
                Tambah
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* VLAN Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={configs}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage={
            <EmptyState
              title="Belum ada VLAN config"
              description="Tambahkan konfigurasi VLAN menggunakan form di atas"
            />
          }
          renderActions={(cfg) => (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(cfg.id)}
            >
              Hapus
            </Button>
          )}
        />
      </div>
    </div>
  );
}
