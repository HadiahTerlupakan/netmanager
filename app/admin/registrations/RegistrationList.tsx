"use client";

import { clientLogger } from "@/lib/client-logger";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  MdRefresh,
  MdSearch,
  MdFilterList,
  MdPublic,
  MdVisibility,
  MdAccessTime,
  MdVerified,
  MdBlock,
  MdConstruction,
  MdInstallDesktop,
  MdCancel,
} from "react-icons/md";
import { Button } from "@/components/ui/Button";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";

interface Registration {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  location: string | null;
  packageName: string | null;
  ipAddress: string | null;
  status:
    | "PENDING"
    | "VERIFIED"
    | "REJECTED"
    | "SURVEYED"
    | "INSTALLED"
    | "CANCELLED";
  notes: string | null;
  createdAt: string;
}

interface IpInfo {
  ip: string;
  country: string;
  countryCode: string;
  isp: string;
  city?: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "PENDING", label: "Menunggu" },
  { value: "VERIFIED", label: "Terverifikasi" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "SURVEYED", label: "Sudah Survei" },
  { value: "INSTALLED", label: "Terinstal" },
  { value: "CANCELLED", label: "Dibatalkan" },
];

export default function AdminRegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ipInfoCache, setIpInfoCache] = useState<Record<string, IpInfo>>({});

  const fetchIpInfo = useCallback(async (ip: string) => {
    try {
      const res = await fetch(`/api/ip-info?ip=${encodeURIComponent(ip)}`);
      if (res.ok) {
        const data = await res.json();
        setIpInfoCache((prev) => ({ ...prev, [ip]: data }));
      }
    } catch (e) {
      clientLogger.error("Failed to fetch IP info", e);
    }
  }, []);

  const fetchRegistrations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/registrations");
      if (res.ok) {
        const response = await res.json();
        const registrationsData = response.data || [];
        setRegistrations(registrationsData);

        // Fetch IP info for each unique IP
        const uniqueIps = [
          ...new Set(
            registrationsData
              .map((r: Registration) => r.ipAddress)
              .filter(Boolean),
          ),
        ] as string[];
        uniqueIps.forEach((ip) => {
          if (!ipInfoCache[ip]) {
            fetchIpInfo(ip);
          }
        });
      }
    } catch (error) {
      clientLogger.error("Failed to fetch registrations", error);
    } finally {
      setIsLoading(false);
    }
  }, [ipInfoCache, fetchIpInfo]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "PENDING":
        return {
          color: "bg-yellow-100 text-yellow-800",
          icon: MdAccessTime,
          label: "Menunggu",
        };
      case "VERIFIED":
        return {
          color: "bg-blue-100 text-blue-800",
          icon: MdVerified,
          label: "Terverifikasi",
        };
      case "REJECTED":
        return {
          color: "bg-red-100 text-red-800",
          icon: MdBlock,
          label: "Ditolak",
        };
      case "SURVEYED":
        return {
          color: "bg-purple-100 text-purple-800",
          icon: MdConstruction,
          label: "Sudah Survei",
        };
      case "INSTALLED":
        return {
          color: "bg-green-100 text-green-800",
          icon: MdInstallDesktop,
          label: "Terinstal",
        };
      case "CANCELLED":
        return {
          color: "bg-gray-100 text-gray-800",
          icon: MdCancel,
          label: "Dibatalkan",
        };
      default:
        return {
          color: "bg-gray-100 text-gray-800",
          icon: MdAccessTime,
          label: status,
        };
    }
  };

  const filteredRegistrations = registrations.filter((reg) => {
    const matchesSearch =
      reg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.phone.includes(searchTerm);

    const matchesStatus = !statusFilter || reg.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Count by status
  const statusCounts = registrations.reduce(
    (acc, reg) => {
      acc[reg.status] = (acc[reg.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const columns: Column<Registration>[] = [
    {
      key: "createdAt",
      header: "Tanggal",
      priority: "secondary",
      render: (reg) => (
        <div className="text-sm text-gray-900 dark:text-white">
          <div>
            {new Date(reg.createdAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
          <div className="text-xs text-slate-400">
            {new Date(reg.createdAt).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      ),
    },
    {
      key: "name",
      header: "Nama",
      priority: "primary",
      render: (reg) => (
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {reg.name}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Kontak",
      priority: "secondary",
      render: (reg) => (
        <div className="flex flex-col text-sm">
          <span className="text-gray-900 dark:text-white">{reg.phone}</span>
          <span className="text-slate-400 text-xs">{reg.email}</span>
        </div>
      ),
    },
    {
      key: "location",
      header: "Area / Lokasi",
      priority: "secondary",
      render: (reg) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {reg.location || "-"}
        </div>
      ),
    },
    {
      key: "packageName",
      header: "Paket",
      priority: "tertiary",
      render: (reg) => (
        <>
          {reg.packageName ? (
            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
              {reg.packageName}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 italic">-</span>
          )}
        </>
      ),
    },
    {
      key: "ipAddress",
      header: "IP Address",
      priority: "tertiary",
      render: (reg) => {
        const ipInfo = reg.ipAddress ? ipInfoCache[reg.ipAddress] : null;
        return reg.ipAddress ? (
          <div className="flex flex-col">
            <span className="font-mono text-xs text-gray-900 dark:text-gray-300">
              {reg.ipAddress}
            </span>
            {ipInfo ? (
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                <MdPublic className="text-slate-400" />
                <span>
                  {ipInfo.country} • {ipInfo.isp}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                Loading...
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 italic">-</span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      priority: "primary",
      render: (reg) => {
        const statusConfig = getStatusConfig(reg.status);
        const StatusIcon = statusConfig.icon;
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${statusConfig.color}`}
          >
            <StatusIcon className="text-sm" />
            {statusConfig.label}
          </span>
        );
      },
    },
  ];

  const renderActions = (reg: Registration) => (
    <Link
      href={`/admin/registrations/${reg.id}`}
      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium"
    >
      <MdVisibility /> Detail
    </Link>
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Pendaftaran Pelanggan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Total: {registrations.length} | Pending:{" "}
            {statusCounts["PENDING"] || 0} | Verified:{" "}
            {statusCounts["VERIFIED"] || 0}
          </p>
        </div>
        <Button onClick={fetchRegistrations}>
          <MdRefresh /> Refresh
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-slate-200 dark:border-gray-700 flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
            <input
              type="text"
              placeholder="Cari nama, email, atau telepon..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative min-w-[180px]">
            <MdFilterList className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white dark:bg-gray-700 text-slate-900 dark:text-white"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="dark:bg-gray-700"
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ResponsiveTable
          data={filteredRegistrations}
          columns={columns}
          keyField="id"
          loading={isLoading}
          emptyMessage={
            searchTerm || statusFilter
              ? "Tidak ada data yang cocok dengan filter."
              : "Belum ada data pendaftaran."
          }
          loadingMessage="Memuat data pendaftaran..."
          renderActions={renderActions}
        />
      </div>
    </div>
  );
}
