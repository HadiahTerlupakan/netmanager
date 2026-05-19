"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineMagnifyingGlass,
  HiOutlineArrowPath,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineTicket,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineStar,
} from "react-icons/hi2";
import { formatDistanceToNow, format } from "date-fns";
import { id } from "date-fns/locale";

import { Button } from "@/components/ui/Button";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import { useApi } from "@/lib/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  pelanggan: {
    id: string;
    idPelanggan: string;
    nama: string;
    noTelp: string | null;
    email: string | null;
  };
  assignedTo: {
    id: string;
    name: string;
  } | null;
  lastReply?: {
    isFromAdmin: boolean;
    createdAt: string;
    message?: string;
  } | null;
  replyCount: number;
}

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
const RATING_REGEX = /(⭐{1,5})/;

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

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Baru",
  IN_PROGRESS: "Dalam Proses",
  WAITING_CUSTOMER: "Menunggu Pelanggan",
  RESOLVED: "Selesai Dikerjakan",
  CLOSED: "Ditutup",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  IN_PROGRESS:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  WAITING_CUSTOMER:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  RESOLVED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CLOSED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-gray-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: "Teknis",
  BILLING: "Tagihan",
  ACCOUNT: "Akun",
  OTHER: "Lainnya",
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

function extractRating(ticket: Ticket): number | null {
  if (ticket.status !== "CLOSED" || !ticket.lastReply?.message) return null;
  const match = RATING_REGEX.exec(ticket.lastReply.message);
  return match?.[1] ? match[1].length : null;
}

function renderStars(rating: number | null) {
  if (rating === null) {
    return <span className="text-gray-400 text-xs">-</span>;
  }
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= rating ? "text-yellow-400" : "text-gray-300"}
        >
          {"★"}
        </span>
      ))}
    </div>
  );
}

interface FilterState {
  search: string;
  statusFilter: string;
  categoryFilter: string;
  priorityFilter: string;
}

const INITIAL_FILTERS: FilterState = {
  search: "",
  statusFilter: "",
  categoryFilter: "",
  priorityFilter: "",
};

export default function SupportContent() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(filters.search, SEARCH_DEBOUNCE_MS);

  // Patch filters + reset page sekaligus dalam satu update — menghindari
  // cascading setState dari useEffect-reset.
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

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari tiket atau pelanggan..."
                value={filters.search}
                onChange={(e) => patchFilters({ search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <FilterSelect
            value={filters.statusFilter}
            onChange={(value) => patchFilters({ statusFilter: value })}
            placeholder="Semua Status"
            options={[
              { value: "OPEN", label: "Baru" },
              { value: "IN_PROGRESS", label: "Dalam Proses" },
              { value: "WAITING_CUSTOMER", label: "Menunggu Pelanggan" },
              { value: "RESOLVED", label: "Selesai" },
              { value: "CLOSED", label: "Ditutup" },
            ]}
          />

          <FilterSelect
            value={filters.categoryFilter}
            onChange={(value) => patchFilters({ categoryFilter: value })}
            placeholder="Semua Kategori"
            options={[
              { value: "TECHNICAL", label: "Teknis" },
              { value: "BILLING", label: "Tagihan" },
              { value: "ACCOUNT", label: "Akun" },
              { value: "OTHER", label: "Lainnya" },
            ]}
          />

          <FilterSelect
            value={filters.priorityFilter}
            onChange={(value) => patchFilters({ priorityFilter: value })}
            placeholder="Semua Prioritas"
            options={[
              { value: "URGENT", label: "Urgent" },
              { value: "HIGH", label: "Tinggi" },
              { value: "MEDIUM", label: "Medium" },
              { value: "LOW", label: "Rendah" },
            ]}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <ResponsiveTable
          data={tickets}
          keyField="id"
          loading={isLoading}
          onRowClick={(ticket) => router.push(`/admin/support/${ticket.id}`)}
          emptyMessage={
            <div className="text-center py-12">
              <HiOutlineChatBubbleLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Tidak ada tiket ditemukan</p>
            </div>
          }
          columns={[
            {
              key: "ticketNumber",
              header: "Tiket",
              priority: "primary",
              render: (ticket: Ticket) => (
                <div className="flex items-center gap-3">
                  <div
                    className={`w-1.5 h-10 rounded-full ${PRIORITY_COLORS[ticket.priority] ?? "bg-gray-400"}`}
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {ticket.subject}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      #{ticket.ticketNumber}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: "pelanggan",
              header: "Pelanggan",
              priority: "primary",
              render: (ticket: Ticket) => (
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {ticket.pelanggan.nama}
                  </div>
                  <div className="text-xs text-gray-500">
                    {ticket.pelanggan.idPelanggan}
                  </div>
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              priority: "secondary",
              render: (ticket: Ticket) => (
                <span
                  className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[ticket.status] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </span>
              ),
            },
            {
              key: "category",
              header: "Kategori",
              priority: "secondary",
              render: (ticket: Ticket) => (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                </span>
              ),
            },
            {
              key: "createdAt",
              header: "Dibuat",
              priority: "tertiary",
              render: (ticket: Ticket) => (
                <div>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {format(new Date(ticket.createdAt), "dd MMM yyyy", {
                      locale: id,
                    })}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(ticket.createdAt), {
                      addSuffix: true,
                      locale: id,
                    })}
                  </div>
                </div>
              ),
            },
            {
              key: "replyCount",
              header: "Balasan",
              priority: "tertiary",
              render: (ticket: Ticket) => (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {ticket.replyCount}
                  </span>
                  {ticket.lastReply &&
                    !ticket.lastReply.isFromAdmin &&
                    ticket.status !== "RESOLVED" &&
                    ticket.status !== "CLOSED" && (
                      <span
                        className="w-2 h-2 bg-red-500 dark:bg-red-400 rounded-full animate-pulse"
                        title="Perlu balasan"
                      />
                    )}
                </div>
              ),
            },
            {
              key: "rating",
              header: "Rating",
              priority: "tertiary",
              render: (ticket: Ticket) => renderStars(extractRating(ticket)),
            },
          ]}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500">
              Halaman {page} dari {totalPages}
              {total > 0 ? ` · Total ${total} tiket` : ""}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <HiChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <HiChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  value: number | string;
  label: string;
}

function StatCard({ icon, iconBg, value, label }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
