"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  HiOutlinePlus,
  HiOutlineUserCircle,
  HiOutlineUsers,
  HiOutlineBuildingOffice,
  HiOutlineEye,
  HiOutlineTrash,
  HiOutlineArrowRightOnRectangle,
  HiOutlineDevicePhoneMobile,
  HiOutlineMap,
  HiOutlineStar,
  HiOutlineClock,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { toast } from "react-hot-toast";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { usePresence } from "@/lib/realtime/hooks/usePresence";
import { usePermission } from "@/hooks/use-permission";
import UserStats from "./components/UserStats";
import UserFilters from "./components/UserFilters";
import UserModals from "./components/UserModals";

interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  departmentId: string | null;
  siteId: string | null;
  isActive: boolean;
  isAttendanceRequired: boolean;
  createdAt: string;
  departments: { id: string; name: string } | null;
  sites?: {
    id: string;
    code: string;
    name: string;
  };
  // Multi-site support
  userSites?: Array<{
    id: string;
    siteId: string;
    isPrimary: boolean;
    site: { id: string; code: string; name: string };
  }>;
  role?: {
    id: string;
    name: string;
  };
  lastVersionCode?: number;
  lastVersionName?: string;
  lastVersionUpdate?: string;
  lastLoginAt?: string;
}

export default function UserList() {
  const { onlineUserIds } = usePresence();
  const { hasPermission } = usePermission();
  const searchParams = useSearchParams();
  const tenantIdFilter = searchParams.get("tenantId");

  const onlineUsers = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);

  // Permissions
  const canCreate = hasPermission("users:create");
  const canUpdate = hasPermission("users:update");
  const canDelete = hasPermission("users:delete");
  const canForceLogout = hasPermission("users:update"); // Usually grouped with update or specialized

  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [inactiveUsers, setInactiveUsers] = useState(0);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [forceLogoutUserId, setForceLogoutUserId] = useState<string | null>(
    null,
  );
  const [forcingLogout, setForcingLogout] = useState(false);

  // Selection state for comparison
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const clearSelection = () => setSelectedUserIds([]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, tenantIdFilter]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (tenantIdFilter) queryParams.append("tenantId", tenantIdFilter);
      queryParams.append("page", currentPage.toString());
      queryParams.append("limit", itemsPerPage.toString());
      if (debouncedSearchTerm)
        queryParams.append("search", debouncedSearchTerm);
      if (statusFilter !== "all") queryParams.append("status", statusFilter);

      const res = await fetch(`/api/admin/users?${queryParams.toString()}`);
      const data = await res.json();
      if (res.ok) {
        const fetchedUsers = data.data?.users || data.users || [];
        const fetchedMeta = data.data?.meta || data.meta || {};

        setUsers(fetchedUsers);
        setTotalUsers(fetchedMeta.total || 0);
        setActiveUsers(fetchedMeta.active || 0);
        setInactiveUsers(fetchedMeta.inactive || 0);
      } else {
        toast.error(data.error || "Gagal memuat data pengguna");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Terjadi kesalahan saat memuat data pengguna");
    } finally {
      setLoading(false);
    }
  }, [
    tenantIdFilter,
    currentPage,
    itemsPerPage,
    debouncedSearchTerm,
    statusFilter,
  ]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async (userId: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setDeleteUserId(null);
        toast.success("Pengguna berhasil dihapus");
        fetchUsers(); // Refresh list
      } else {
        toast.error(data.error || "Gagal menghapus pengguna");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Terjadi kesalahan saat menghapus pengguna");
    } finally {
      setDeleting(false);
    }
  };

  const handleForceLogout = async (userId: string) => {
    setForcingLogout(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/force-logout`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "User berhasil di-logout paksa");
        setForceLogoutUserId(null);
      } else {
        toast.error(data.error || "Gagal force logout user");
      }
    } catch (error) {
      console.error("Error force logout user:", error);
      toast.error("Terjadi kesalahan saat force logout");
    } finally {
      setForcingLogout(false);
    }
  };

  const totalPages = Math.ceil(totalUsers / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;

  // Define columns for ResponsiveTable
  const columns: Column<User>[] = [
    {
      key: "selection",
      header: "",
      priority: "primary",
      render: (user) => (
        <input
          type="checkbox"
          checked={selectedUserIds.includes(user.id)}
          onChange={() => toggleUserSelection(user.id)}
          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      key: "name",
      header: "Pengguna",
      priority: "primary",
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="relative shrink-0 h-10 w-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <HiOutlineUserCircle className="w-5 h-5 text-white" />
            {/* Online Indicator */}
            <div
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                onlineUsers.has(user.id) ? "bg-green-500" : "bg-gray-400"
              }`}
              title={onlineUsers.has(user.id) ? "Online" : "Offline"}
            />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
              {user.name || user.email.split("@")[0]}
              {onlineUsers.has(user.id) && (
                <span className="inline-block px-1.5 py-0.5 text-[10px] leading-none bg-green-100 text-green-700 rounded-full font-medium">
                  Online
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {user.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Telepon",
      priority: "secondary",
      render: (user) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {user.phone || "-"}
        </span>
      ),
    },
    {
      key: "departments",
      header: "Departemen",
      priority: "secondary",
      render: (user) =>
        user.departments?.name ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <HiOutlineBuildingOffice className="w-3.5 h-3.5 text-gray-400" />
            {user.departments.name}
          </span>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        ),
    },
    {
      key: "sites",
      header: "Site",
      priority: "secondary",
      render: (user) => {
        // Multi-site: show all sites with primary indicator
        if (user.userSites && user.userSites.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {user.userSites.slice(0, 2).map((us) => (
                <span
                  key={us.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    us.isPrimary
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  }`}
                >
                  {us.isPrimary && <HiOutlineStar className="w-3 h-3" />}
                  {us.site.code}
                </span>
              ))}
              {user.userSites.length > 2 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                  +{user.userSites.length - 2}
                </span>
              )}
            </div>
          );
        }
        // Fallback: legacy single site
        return user.sites?.code ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <HiOutlineMap className="w-3.5 h-3.5 text-gray-400" />
            {user.sites.code}
          </span>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        );
      },
    },
    {
      key: "role",
      header: "Peran",
      priority: "primary",
      render: (user) => (
        <div className="text-sm text-gray-900 dark:text-gray-100 font-medium">
          {user.role?.name || "-"}
        </div>
      ),
    },
    {
      key: "lastVersionCode",
      header: "App Version",
      priority: "secondary",
      render: (user) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-sm text-gray-900 dark:text-gray-100">
            <HiOutlineDevicePhoneMobile className="w-4 h-4 text-gray-400" />
            <span>
              {user.lastVersionName
                ? `v${user.lastVersionName} (Build ${user.lastVersionCode})`
                : user.lastVersionCode
                  ? `Build ${user.lastVersionCode}`
                  : "-"}
            </span>
          </div>
          {user.lastVersionUpdate && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(user.lastVersionUpdate).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "lastLoginAt",
      header: "Terakhir Login",
      priority: "secondary",
      render: (user) => {
        if (!user.lastLoginAt) {
          return <span className="text-sm text-gray-400">Belum pernah</span>;
        }
        const date = new Date(user.lastLoginAt);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let timeAgo: string;
        if (diffMins < 1) timeAgo = "Baru saja";
        else if (diffMins < 60) timeAgo = `${diffMins} menit lalu`;
        else if (diffHours < 24) timeAgo = `${diffHours} jam lalu`;
        else if (diffDays < 7) timeAgo = `${diffDays} hari lalu`;
        else
          timeAgo = date.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });

        return (
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <HiOutlineClock className="w-3.5 h-3.5 text-gray-400" />
              {timeAgo}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {date.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}{" "}
              {date.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        );
      },
    },
    {
      key: "isAttendanceRequired",
      header: "Wajib Absen",
      priority: "secondary",
      render: (user) => (
        <div className="flex items-center gap-1.5">
          {user.isAttendanceRequired ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              YA
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              TIDAK
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      priority: "primary",
      render: (user) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            user.isActive
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {user.isActive ? "Aktif" : "Nonaktif"}
        </span>
      ),
    },
  ];

  // Render actions for each row
  const renderActions = (user: User) => (
    <>
      <Link
        href={`/admin/users/${user.id}?view=true`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        title="Lihat Detail"
        aria-label={`Lihat detail ${user.name || user.email}`}
      >
        <HiOutlineEye className="w-4 h-4" />
      </Link>
      {canUpdate && (
        <Link
          href={`/admin/users/${user.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
        >
          Edit
        </Link>
      )}
      {canForceLogout && (
        <button
          onClick={() => setForceLogoutUserId(user.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/50 transition-colors"
          title="Force Logout"
          aria-label={`Force logout ${user.name || user.email}`}
        >
          <HiOutlineArrowRightOnRectangle className="w-4 h-4" />
        </button>
      )}
      {canDelete && (
        <button
          onClick={() => setDeleteUserId(user.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
          title="Hapus"
          aria-label={`Hapus ${user.name || user.email}`}
        >
          <HiOutlineTrash className="w-4 h-4" />
        </button>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manajemen Pengguna
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Kelola pengguna sistem
          </p>
        </div>
        {canCreate && (
          <Link
            href={
              tenantIdFilter
                ? `/admin/users/new?tenantId=${tenantIdFilter}`
                : "/admin/users/new"
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors shadow-sm"
          >
            <HiOutlinePlus className="w-5 h-5 text-white" />
            <span className="text-white">Tambah Pengguna</span>
          </Link>
        )}
      </div>

      {tenantIdFilter && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HiOutlineBuildingOffice className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                Memfilter berdasarkan Tenant
              </p>
              <p className="text-xs text-indigo-700 dark:text-indigo-400">
                Menampilkan semua akun administrator untuk tenant yang dipilih.
              </p>
            </div>
          </div>
          <Link
            href="/admin/users"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline"
          >
            Hapus Filter
          </Link>
        </div>
      )}

      <UserStats
        totalUsers={totalUsers}
        activeUsers={activeUsers}
        inactiveUsers={inactiveUsers}
      />

      <UserFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {/* Users List Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <PageLoader variant="section" message="Memuat data pengguna..." />
        ) : users.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <HiOutlineUsers className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              Tidak ada pengguna ditemukan
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm || statusFilter !== "all"
                ? "Coba ubah filter atau kata kunci pencarian Anda"
                : "Mulai dengan menambahkan pengguna baru"}
            </p>
            {canCreate && (
              <Link
                href="/admin/users/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
              >
                <HiOutlinePlus className="w-5 h-5 text-white" />
                <span className="text-white">Tambah Pengguna</span>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Responsive Table */}
            <ResponsiveTable
              data={users}
              columns={columns}
              keyField="id"
              renderActions={renderActions}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Menampilkan {startIndex + 1} -{" "}
                  {Math.min(startIndex + itemsPerPage, totalUsers)} dari{" "}
                  {totalUsers} pengguna
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Hal {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Comparison Bar */}
      {selectedUserIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-indigo-100 dark:border-indigo-900 px-6 py-4 flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {selectedUserIds.length} Pengguna Terpilih
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Pilih minimal 2 untuk membandingkan
            </span>
          </div>

          <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />

          <div className="flex items-center gap-3">
            <button
              onClick={clearSelection}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Batal
            </button>
            <Link
              href={`/admin/users/compare?ids=${selectedUserIds.join(",")}`}
              className={`px-6 py-2 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 ${
                selectedUserIds.length >= 2
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white translate-y-0 opacity-100 shadow-indigo-200 dark:shadow-indigo-900/20"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed pointer-events-none"
              }`}
            >
              <HiOutlineStar className="w-4 h-4" />
              Bandingkan Kinerja
            </Link>
          </div>
        </div>
      )}

      <UserModals
        deleteUserId={deleteUserId}
        setDeleteUserId={setDeleteUserId}
        deleting={deleting}
        handleDelete={handleDelete}
        forceLogoutUserId={forceLogoutUserId}
        setForceLogoutUserId={setForceLogoutUserId}
        forcingLogout={forcingLogout}
        handleForceLogout={handleForceLogout}
      />
    </div>
  );
}
