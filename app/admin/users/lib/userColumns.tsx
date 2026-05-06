import Link from "next/link";
import {
  HiOutlineUserCircle,
  HiOutlineBuildingOffice,
  HiOutlineMap,
  HiOutlineStar,
  HiOutlineClock,
  HiOutlineDevicePhoneMobile,
  HiOutlineEye,
  HiOutlineTrash,
  HiOutlineArrowRightOnRectangle,
} from "react-icons/hi2";
import type { Column } from "@/components/ui/ResponsiveTable";
import type { User } from "./types";
import { formatTimeAgo, formatDateTime } from "./timeUtils";
import { USER_LIST_CONSTANTS } from "./constants";

interface UserColumnsOptions {
  onlineUsers: Set<string>;
  selectedUserIds: string[];
  toggleUserSelection: (userId: string) => void;
  canUpdate: boolean;
  canDelete: boolean;
  canForceLogout: boolean;
  setDeleteUserId: (userId: string) => void;
  setForceLogoutUserId: (userId: string) => void;
}

/**
 * Generate column definitions for user list table.
 */
export function getUserColumns(options: UserColumnsOptions): Column<User>[] {
  const { onlineUsers, selectedUserIds, toggleUserSelection } = options;

  return [
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
        if (user.userSites && user.userSites.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {user.userSites
                .slice(0, USER_LIST_CONSTANTS.MAX_SITES_DISPLAY)
                .map((us) => (
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
              {user.userSites.length >
                USER_LIST_CONSTANTS.MAX_SITES_DISPLAY && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                  +
                  {user.userSites.length -
                    USER_LIST_CONSTANTS.MAX_SITES_DISPLAY}
                </span>
              )}
            </div>
          );
        }

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
        const timeAgo = formatTimeAgo(date);
        const dateTime = formatDateTime(date);

        return (
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
              <HiOutlineClock className="w-3.5 h-3.5 text-gray-400" />
              {timeAgo}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {dateTime}
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
}

/**
 * Render action buttons for each user row.
 */
export function renderUserActions(
  user: User,
  options: Pick<
    UserColumnsOptions,
    | "canUpdate"
    | "canDelete"
    | "canForceLogout"
    | "setDeleteUserId"
    | "setForceLogoutUserId"
  >,
) {
  const {
    canUpdate,
    canDelete,
    canForceLogout,
    setDeleteUserId,
    setForceLogoutUserId,
  } = options;

  return (
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
}
