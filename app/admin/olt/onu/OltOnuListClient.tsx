"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import ResponsiveTable, { type Column } from "@/components/ui/ResponsiveTable";
import PageLoader from "@/components/ui/PageLoader";

interface OnuItem {
  id: string;
  serialNumber: string;
  slotFrame: number;
  slot: number;
  ponPort: number;
  onuIndex: number;
  status: string;
  vlanId: number | null;
  bandwidthProfile: string | null;
  pelangganId: string | null;
  description: string | null;
  rxPower: number | null;
  txPower: number | null;
  oltRxPower: number | null;
  olt?: { name: string; vendor: string };
  pelanggan?: { nama: string; username: string } | null;
}

interface OltOption {
  id: string;
  name: string;
  vendor: string;
}

interface CardOption {
  id: string;
  slotFrame: number;
  slot: number;
  cardType: string | null;
  ponCount: number;
}

type Mode = "idle" | "browsing" | "searching";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800",
  REGISTERED:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  UNREGISTERED:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700",
  OFFLINE:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800",
  DISABLED:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800",
  LOS: "bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-800",
  DYING_GASP:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800",
};

export default function OltOnuListClient() {
  const [onus, setOnus] = useState<OnuItem[]>([]);
  const [loading, startTransition] = useTransition();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const [olts, setOlts] = useState<OltOption[]>([]);
  const [cards, setCards] = useState<CardOption[]>([]);

  const [selectedOltId, setSelectedOltId] = useState("");
  const [selectedCard, setSelectedCard] = useState<CardOption | null>(null);
  const [selectedPonPort, setSelectedPonPort] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const mode: Mode = debouncedSearch
    ? "searching"
    : selectedOltId
      ? "browsing"
      : "idle";

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await fetch("/api/olt/devices?status=ACTIVE&limit=100");
      const json = await res.json();
      if (cancelled) return;
      if (json.success) {
        setOlts(json.data?.data ?? json.data ?? []);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!selectedOltId) return;
    let cancelled = false;
    const load = async () => {
      const res = await fetch(`/api/olt/devices/${selectedOltId}/cards`);
      const json = await res.json();
      if (cancelled) return;
      if (json.success) {
        setCards(json.data ?? []);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedOltId]);

  useEffect(() => {
    if (mode === "idle") return;

    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), limit: "20" });

    if (mode === "searching") {
      params.set("search", debouncedSearch);
    } else {
      if (selectedOltId) params.set("oltId", selectedOltId);
      if (selectedCard) {
        params.set("slotFrame", String(selectedCard.slotFrame));
        params.set("slot", String(selectedCard.slot));
      }
      if (selectedPonPort) params.set("ponPort", selectedPonPort);
    }

    if (statusFilter) params.set("status", statusFilter);

    startTransition(async () => {
      const res = await fetch(`/api/olt/onu?${params}`);
      const json = await res.json();
      if (cancelled) return;
      if (json.success) {
        setOnus(json.data.data);
        setTotalPages(json.data.pagination.totalPages);
        setTotal(json.data.pagination.total);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    mode,
    page,
    debouncedSearch,
    selectedOltId,
    selectedCard,
    selectedPonPort,
    statusFilter,
  ]);

  const handleOltChange = (oltId: string) => {
    setSelectedOltId(oltId);
    setSelectedCard(null);
    setSelectedPonPort("");
    setPage(1);
  };

  const handleCardChange = (cardId: string) => {
    if (cardId === "") {
      setSelectedCard(null);
      setSelectedPonPort("");
    } else {
      const card = cards.find((c) => c.id === cardId) ?? null;
      setSelectedCard(card);
      setSelectedPonPort("");
    }
    setPage(1);
  };

  const handlePonChange = (pon: string) => {
    setSelectedPonPort(pon);
    setPage(1);
  };

  const isSearching = mode === "searching";
  const scopeDisabled = isSearching ? "opacity-50 pointer-events-none" : "";

  const formatPower = (power: number | null): string =>
    power === null ? "N/A" : `${power.toFixed(2)} dBm`;

  const powerColor = (power: number | null): string => {
    if (power === null) return "text-gray-400 dark:text-gray-500";
    if (power < -28) return "text-red-600 dark:text-red-400";
    if (power < -25) return "text-orange-600 dark:text-orange-400";
    return "text-green-600 dark:text-green-400";
  };

  const statusLabel = (status: string): string => {
    if (status === "ACTIVE") return "Online";
    if (status === "OFFLINE") return "Offline";
    if (status === "LOS") return "LOS";
    if (status === "DYING_GASP") return "DyingGasp";
    if (status === "DISABLED") return "Disabled";
    if (status === "REGISTERED") return "Registered";
    if (status === "UNREGISTERED") return "Unregistered";
    return status;
  };

  const statusIcon = (status: string): string => {
    if (status === "ACTIVE") return "✓";
    if (status === "OFFLINE") return "○";
    if (status === "LOS") return "✕";
    if (status === "DYING_GASP") return "◐";
    return "•";
  };

  const extractPppoe = (item: OnuItem): string => {
    if (item.pelanggan?.username) return item.pelanggan.username;
    const desc = item.description ?? "";

    // Kalau description berisi format email (contains @), pakai email itu
    const emailMatch = desc.match(/[\w.-]+@[\w.-]+/);
    if (emailMatch) return emailMatch[0];

    // Strip prefix "ONU-X:Y-" kalau ada, lalu ambil token sebelum tanda dash
    const stripped = desc.replace(/^ONU-\d+:\d+-?/i, "");

    // Format "idpelanggan-Nama" → ambil idpelanggan
    const idMatch = stripped.match(/^(\S+?)-/);
    if (idMatch) return idMatch[1];

    // Kalau cuma satu kata (contoh: "ROSIDIN", "ONU-7:5") → tampilkan apa adanya
    if (stripped) return stripped;

    return item.serialNumber;
  };

  const columns: Column<OnuItem>[] = [
    {
      key: "olt",
      header: "OLT",
      priority: "primary",
      render: (item) => (
        <span className="text-gray-700 dark:text-gray-300 text-xs font-medium">
          {item.olt?.name ?? "-"}
        </span>
      ),
    },
    {
      key: "name",
      header: "Name",
      priority: "primary",
      render: (item) => {
        const label = item.description
          ? `ONU-${item.ponPort}:${item.onuIndex}-${item.description}`
          : `ONU-${item.ponPort}:${item.onuIndex}`;
        return (
          <Link
            href={`/admin/olt/onu/${item.id}`}
            className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs"
            title={label}
          >
            {label}
          </Link>
        );
      },
    },
    {
      key: "serialNumber",
      header: "SN",
      priority: "secondary",
      render: (item) => (
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
          {item.serialNumber}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      priority: "tertiary",
      render: (item) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
          ONU-{item.ponPort}:{item.onuIndex}
        </span>
      ),
    },
    {
      key: "pppoe",
      header: "PPPoE",
      priority: "secondary",
      render: (item) => (
        <span className="text-gray-700 dark:text-gray-300 text-xs">
          {extractPppoe(item)}
        </span>
      ),
    },
    {
      key: "onuId",
      header: "ONU ID",
      priority: "primary",
      render: (item) => (
        <span className="inline-flex px-2 py-0.5 rounded font-mono text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
          {item.slotFrame}/{item.slot}/{item.ponPort}:{item.onuIndex}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      priority: "primary",
      render: (item) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
        >
          <span aria-hidden>{statusIcon(item.status)}</span>
          {statusLabel(item.status)}
        </span>
      ),
    },
    {
      key: "rxOlt",
      header: "RX OLT",
      priority: "tertiary",
      render: (item) => (
        <span
          className={`text-xs font-mono ${powerColor(item.oltRxPower)}`}
          title="Power yang diterima OLT dari ONU"
        >
          {formatPower(item.oltRxPower)}
        </span>
      ),
    },
    {
      key: "rxOnu",
      header: "RX ONU",
      priority: "tertiary",
      render: (item) => (
        <span
          className={`text-xs font-mono ${powerColor(item.rxPower)}`}
          title="Power yang diterima ONU dari OLT"
        >
          {formatPower(item.rxPower)}
        </span>
      ),
    },
  ];

  if (loading && onus.length === 0 && mode !== "idle") {
    return <PageLoader variant="section" message="Memuat data ONU..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Daftar ONU
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {mode === "idle"
              ? "Pilih OLT atau ketik pencarian untuk memulai"
              : `${total} ONU ditemukan`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/olt/onu/unregistered">
            <Button variant="warning" size="sm">
              Unregistered
            </Button>
          </Link>
          <Link href="/admin/olt/onu/pre-register">
            <Button variant="default" size="sm">
              Pre-Register
            </Button>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div>
        <input
          type="text"
          placeholder="Cari SN, deskripsi, atau nama pelanggan (lintas semua OLT)"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
        />
        {isSearching && (
          <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">
            Pencarian global aktif — filter scope dinonaktifkan
          </p>
        )}
      </div>

      {/* Scope Filters */}
      <div className={`flex flex-col sm:flex-row gap-3 ${scopeDisabled}`}>
        <select
          value={selectedOltId}
          onChange={(e) => handleOltChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          <option value="">Pilih OLT...</option>
          {olts.map((olt) => (
            <option key={olt.id} value={olt.id}>
              {olt.name} ({olt.vendor})
            </option>
          ))}
        </select>

        <select
          value={selectedCard?.id ?? ""}
          onChange={(e) => handleCardChange(e.target.value)}
          disabled={!selectedOltId}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm disabled:opacity-50"
        >
          <option value="">
            {cards.length === 0 && selectedOltId
              ? "Belum ada card — sync di halaman OLT"
              : "Semua Card"}
          </option>
          {cards.map((card) => (
            <option key={card.id} value={card.id}>
              Frame {card.slotFrame} / Slot {card.slot}
              {card.cardType ? ` (${card.cardType})` : ""}
            </option>
          ))}
        </select>

        <select
          value={selectedPonPort}
          onChange={(e) => handlePonChange(e.target.value)}
          disabled={!selectedCard}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm disabled:opacity-50"
        >
          <option value="">Semua PON</option>
          {selectedCard &&
            Array.from({ length: selectedCard.ponCount }, (_, i) => i + 1).map(
              (pon) => (
                <option key={pon} value={pon}>
                  PON {pon}
                </option>
              ),
            )}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          <option value="">Semua Status</option>
          <option value="ACTIVE">Active</option>
          <option value="REGISTERED">Registered</option>
          <option value="UNREGISTERED">Unregistered</option>
          <option value="OFFLINE">Offline</option>
          <option value="DISABLED">Disabled</option>
          <option value="LOS">LOS</option>
          <option value="DYING_GASP">Dying Gasp</option>
        </select>
      </div>

      {/* Content */}
      {mode === "idle" ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Pilih OLT atau ketik pencarian untuk memulai
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <ResponsiveTable
            data={onus}
            columns={columns}
            keyField="id"
            loading={loading}
            emptyMessage={
              mode === "searching"
                ? `Tidak ada ONU dengan kata kunci '${debouncedSearch}'`
                : "Tidak ada ONU pada scope ini"
            }
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
