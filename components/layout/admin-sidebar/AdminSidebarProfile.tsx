import Image from "next/image";
import { signOut } from "next-auth/react";

import { HiArrowRightOnRectangle } from "./adminSidebarIcons";

type AdminSidebarProfileProps = {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
};

/** Tujuan: merender ringkasan profil dan aksi logout pada sidebar admin. */
export function AdminSidebarProfile({ user }: AdminSidebarProfileProps) {
  const displayName = user?.name || "User";
  const displayEmail = user?.email || "admin@example.com";
  const fallbackInitial = displayName.charAt(0).toUpperCase();

  return (
    <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-100 to-violet-100 dark:from-indigo-900 dark:to-violet-900 flex items-center justify-center border-2 border-white dark:border-gray-700 shadow-sm shrink-0 relative overflow-hidden">
          {user?.image ? (
            <Image
              width={40}
              height={40}
              src={user.image}
              alt={displayName}
              className="object-cover"
            />
          ) : (
            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-300">
              {fallbackInitial}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {displayName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {displayEmail}
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
          title="Sign Out"
          aria-label="Keluar dari akun"
        >
          <HiArrowRightOnRectangle className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
