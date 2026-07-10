"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineMagnifyingGlass,
  HiOutlineArrowPath,
  HiOutlineTicket,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineStar,
} from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";

import { StatCard } from "./_components/StatCard";
import {
  FilterBar,
  INITIAL_FILTERS,
  type FilterState,
} from "./_components/FilterBar";
import { TicketTable, type Ticket } from "./_components/TicketTable";

interface Stats {
  total: number;
  open: number;
  inProgress: number;
  waitingCustomer: number;
  resolved: number;
  closed: number;
  avgRating: number;
  ratedCount: number;
}

interface TicketListResponse {
  tickets?: Ticket[];
  pagination?: {
    total?: number;
    totalPages?: number;
  };
  stats?: Stats;
}

const SEARCH_DEBOUNCE_MS = 400;
const PAGE_SIZE = 20;

const DEFAULT_STATS: Stats = {
  total: 0,
  open: 0,
  inProgress: 0,
  waitingCustomer: 0,
  resolved: 0,
  closed: 0,
  avgRating: 0,
  ratedCount: 0,
};

function buildTicketListUrl(input: {
  page: number;
  search: string;
  statusFilter: string;
  categoryFilter: string;
  priorityFilter: string;
}) {
  const params = new URLSearchParams();
  params.set("page", input.page.toString());
  params.set("limit", PAGE_SIZE.toString());
  if (input.search) params.set("search", input.search);
  if (input.statusFilter) params.set("status", input.statusFilter);
  if (input.categoryFilter) params.set("category", input.categoryFilter);
  if (input.priorityFilter) params.set("priority", input.priorityFilter);
  return `/api/admin/support-tickets?${params.toString()}`;
}

export default function SupportContent() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(filters.search, SEARCH_DEBOUNCE_MS);

  const patchFilters = (patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const url = buildTicketListUrl({
    page,
    search: debouncedSearch,
    statusFilter: filters.statusFilter,
    categoryFilter: filters.categoryFilter,
    priorityFilter: filters.priorityFilter,
  });

  const { data, isLoading, mutate } = useApi<TicketListResponse>(url);

  const tickets = data?.tickets ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const total = data?.pagination?.total ?? 0;
  const stats = data?.stats ?? DEFAULT_STATS;

  // Derived clamp — hindari setState di effect (cascading renders). Kalau
  // page melewati totalPages (mis. setelah filter mengecilkan hasil), tampilkan
  // page 1 sampai user navigasi.
  const displayPage = page > totalPages ? 1 : page;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <HiOutlineChatBubbleLeftRight className="w-7 h-7 text-teal-600" />
            Tiket Dukungan Pelanggan
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelola tiket dukungan dari pelanggan
          </p>
        </div>
        <Button onClick={() => mutate()}>
          <HiOutlineArrowPath className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={
            <HiOutlineTicket className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          }
          iconBg="bg-teal-100 dark:bg-teal-900/30"
          value={stats.total}
          label="Total Tiket"
        />
        <StatCard
          icon={
            <HiOutlineClock className="w-5 h-5 text-red-600 dark:text-red-400" />
          }
          iconBg="bg-red-100 dark:bg-red-900/30"
          value={stats.open + stats.inProgress}
          label="Perlu Ditangani"
        />
        <StatCard
          icon={
            <HiOutlineCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          }
          iconBg="bg-green-100 dark:bg-green-900/30"
          value={stats.closed}
          label="Selesai"
        />
        <StatCard
          icon={
            <HiOutlineStar className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          }
          iconBg="bg-yellow-100 dark:bg-yellow-900/30"
          value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "-"}
          label={`Rating ${stats.ratedCount > 0 ? `(${stats.ratedCount})` : ""}`}
        />
      </div>

      <FilterBar
        filters={filters}
        onPatch={patchFilters}
        searchIcon={
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        }
      />

      <TicketTable
        tickets={tickets}
        isLoading={isLoading}
        totalPages={totalPages}
        total={total}
        page={displayPage}
        onRowClick={(ticket) => router.push(`/admin/support/${ticket.id}`)}
        onPageChange={setPage}
      />
    </div>
  );
}
