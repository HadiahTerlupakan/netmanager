"use client";

import { useMemo, useState } from "react";

import { Activity } from "lucide-react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

import { DevicesSummary } from "@/app/admin/network/acs/devices/components/DevicesSummary";
import { DevicesTable } from "@/app/admin/network/acs/devices/components/DevicesTable";
import { DevicesToolbar } from "@/app/admin/network/acs/devices/components/DevicesToolbar";
import { useDevicesQuery } from "@/app/admin/network/acs/devices/hooks/useDevicesQuery";
import type { Device } from "@/app/admin/network/acs/devices/lib/acsDeviceTypes";

const REFRESH_DELAY_MS = 3000;
const ONLINE_THRESHOLD_MINUTES = 10;
const CRITICAL_RX_THRESHOLD = -26;

export type StatusFilter = "all" | "online" | "offline" | "critical";
export type SortField = "serialNumber" | "pppoe" | "rxpower" | "lastInform";
export type SortDirection = "asc" | "desc";

function isDeviceOnline(lastInform: string | null): boolean {
  if (!lastInform) return false;
  return (
    Date.now() - new Date(lastInform).getTime() <=
    ONLINE_THRESHOLD_MINUTES * 60_000
  );
}

function isCriticalRx(rxpower: string | null): boolean {
  if (!rxpower) return false;
  const val = parseFloat(rxpower);
  return !isNaN(val) && val < CRITICAL_RX_THRESHOLD;
}

function sortDevices(
  devices: Device[],
  field: SortField,
  direction: SortDirection,
): Device[] {
  return [...devices].sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";

    switch (field) {
      case "serialNumber":
        aVal = a.serialNumber?.toLowerCase() || "";
        bVal = b.serialNumber?.toLowerCase() || "";
        break;
      case "pppoe":
        aVal = a.pppoe?.toLowerCase() || "";
        bVal = b.pppoe?.toLowerCase() || "";
        break;
      case "rxpower":
        aVal = a.rxpower ? parseFloat(a.rxpower) : -999;
        bVal = b.rxpower ? parseFloat(b.rxpower) : -999;
        break;
      case "lastInform":
        aVal = a.lastInform ? new Date(a.lastInform).getTime() : 0;
        bVal = b.lastInform ? new Date(b.lastInform).getTime() : 0;
        break;
    }

    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

export function DevicesClient() {
  const router = useRouter();
  const { showToast } = useToast();
  const { devices, loading, refresh } = useDevicesQuery({ showToast });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("lastInform");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const itemsPerPage = 10;

  const summary = useMemo(() => {
    const online = devices.filter((d) => isDeviceOnline(d.lastInform)).length;
    const offline = devices.length - online;
    const critical = devices.filter((d) => isCriticalRx(d.rxpower)).length;
    return { total: devices.length, online, offline, critical };
  }, [devices]);

  const filteredDevices = useMemo(() => {
    let result = devices;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (device) =>
          device.serialNumber?.toLowerCase().includes(term) ||
          device.productClass?.toLowerCase().includes(term) ||
          device.pppoe?.toLowerCase().includes(term) ||
          device.ipAddress?.includes(searchTerm),
      );
    }

    switch (statusFilter) {
      case "online":
        result = result.filter((d) => isDeviceOnline(d.lastInform));
        break;
      case "offline":
        result = result.filter((d) => !isDeviceOnline(d.lastInform));
        break;
      case "critical":
        result = result.filter((d) => isCriticalRx(d.rxpower));
        break;
    }

    return sortDevices(result, sortField, sortDirection);
  }, [devices, searchTerm, statusFilter, sortField, sortDirection]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredDevices.length / itemsPerPage),
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDevices = filteredDevices.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const handleSummon = async (deviceId: string) => {
    try {
      showToast("info", "Mengirim perintah Summon...");
      const res = await fetch(
        `/api/acs/devices/${encodeURIComponent(deviceId)}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionRequest: true }),
        },
      );
      const result = await res.json();
      if (result.success) {
        showToast("success", "Summon berhasil, perangkat akan segera melapor");
        setTimeout(() => {
          void refresh();
        }, REFRESH_DELAY_MS);
      } else {
        showToast("error", result.error || "Gagal summon perangkat");
      }
    } catch (_err) {
      showToast("error", "Terjadi kesalahan sistem saat summon");
    }
  };

  const handleDelete = async (deviceId: string) => {
    try {
      const res = await fetch(
        `/api/acs/devices/${encodeURIComponent(deviceId)}`,
        {
          method: "DELETE",
        },
      );
      const result = await res.json();
      if (result.success) {
        showToast("success", "Perangkat berhasil dihapus");
        await refresh();
      } else {
        showToast("error", result.error || "Gagal menghapus perangkat");
      }
    } catch (_err) {
      showToast("error", "Terjadi kesalahan sistem saat menghapus");
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pt-4 pb-12">
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Perangkat"
        description="Hapus perangkat ini dari ACS? Data historis mungkin akan hilang."
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={() => {
          if (deleteTarget) {
            void handleDelete(deleteTarget);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <DevicesSummary
        summary={summary}
        activeFilter={statusFilter}
        onFilterChange={(filter) => {
          setStatusFilter(filter);
          setCurrentPage(1);
        }}
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h2 className="text-[22px] font-bold text-gray-900 dark:text-white flex items-center">
              <Activity className="w-6 h-6 mr-2 text-[#3b5fe5] dark:text-blue-400" />{" "}
              ONT Devices
            </h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
              Kelola dan monitor seluruh perangkat Router/ONT yang terhubung
            </p>
          </div>

          <DevicesToolbar
            searchTerm={searchTerm}
            loading={loading}
            statusFilter={statusFilter}
            onSearchChange={(value) => {
              setSearchTerm(value);
              setCurrentPage(1);
            }}
            onStatusFilterChange={(filter) => {
              setStatusFilter(filter);
              setCurrentPage(1);
            }}
            onRefresh={() => {
              void refresh();
            }}
          />
        </div>

        <DevicesTable
          loading={loading}
          devices={paginatedDevices}
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          itemsPerPage={itemsPerPage}
          filteredDevicesLength={filteredDevices.length}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onPrevPage={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          onNextPage={() =>
            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
          }
          onView={(deviceId) =>
            router.push("/admin/network/acs/devices/" + deviceId)
          }
          onSummon={(deviceId) => {
            void handleSummon(deviceId);
          }}
          onDelete={(deviceId) => setDeleteTarget(deviceId)}
        />
      </div>
    </div>
  );
}
