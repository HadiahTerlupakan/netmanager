import Link from "next/link";

import type { MenuConfig } from "@/lib/menu-config";
import { HiChevronDown } from "./adminSidebarIcons";
import { renderAdminSidebarIcon } from "./adminSidebarIcons";
import {
  getSidebarSectionContentId,
  hasActiveSidebarChild,
  isSidebarItemActive,
} from "./adminSidebarMenu";

type AdminSidebarNavProps = {
  items: MenuConfig[];
  pathname: string;
  isMenuExpanded: (code: string) => boolean;
  onToggleMenu: (code: string) => void;
};

/** Tujuan: merender daftar navigasi sidebar admin beserta menu collapsible. */
export function AdminSidebarNav({
  items,
  pathname,
  isMenuExpanded,
  onToggleMenu,
}: AdminSidebarNavProps) {
  return (
    <nav className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 scrollbar-track-transparent hover:scrollbar-thumb-gray-300 dark:hover:scrollbar-thumb-gray-700">
      <div className="space-y-1">
        {items.map((item, index) => {
          const previousItem = index > 0 ? items[index - 1] : null;
          const showSectionHeader =
            item.section && item.section !== previousItem?.section;
          const sectionHeader = showSectionHeader ? (
            <div className="pt-4 pb-2 first:pt-0">
              <h3 className="px-4 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {item.section}
              </h3>
            </div>
          ) : null;

          const hasChildren = Boolean(item.children?.length);
          return hasChildren ? (
            <div key={item.code}>
              {sectionHeader}
              <AdminSidebarParentItem
                item={item}
                pathname={pathname}
                isExpanded={isMenuExpanded(item.code)}
                onToggleMenu={onToggleMenu}
              />
            </div>
          ) : (
            <div key={item.code}>
              {sectionHeader}
              <AdminSidebarLinkItem item={item} pathname={pathname} />
            </div>
          );
        })}
      </div>
    </nav>
  );
}

type AdminSidebarItemProps = {
  item: MenuConfig;
  pathname: string;
};

type AdminSidebarParentItemProps = AdminSidebarItemProps & {
  isExpanded: boolean;
  onToggleMenu: (code: string) => void;
};

function AdminSidebarParentItem({
  item,
  pathname,
  isExpanded,
  onToggleMenu,
}: AdminSidebarParentItemProps) {
  const isActive = isSidebarItemActive({ item, pathname });
  const hasActiveChild = hasActiveSidebarChild(item.children, pathname);
  const collapsibleContentId = getSidebarSectionContentId(item.code);

  return (
    <div className="space-y-1 mb-1">
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={collapsibleContentId}
        onClick={() => onToggleMenu(item.code)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden ${
          isActive || hasActiveChild
            ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-900/10"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200"
        }`}
      >
        {(isActive || hasActiveChild) && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />
        )}

        <div className="flex items-center gap-3.5 z-10">
          <span
            className={`transition-colors duration-200 ${
              isActive || hasActiveChild
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
            }`}
          >
            {renderAdminSidebarIcon(item.icon, "w-5 h-5")}
          </span>
          <span>{item.name}</span>
        </div>
        <HiChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-300 ease-in-out ${
            isExpanded ? "rotate-180 text-indigo-500" : ""
          }`}
        />
      </button>

      <div
        id={collapsibleContentId}
        aria-hidden={!isExpanded}
        className={`grid transition-all duration-300 ease-in-out ${
          isExpanded
            ? "grid-rows-[1fr] opacity-100 translate-y-0"
            : "grid-rows-[0fr] opacity-0 -translate-y-2"
        }`}
      >
        <div className="overflow-hidden">
          {isExpanded ? (
            <div className="relative border-l-2 border-gray-100 dark:border-gray-800 ml-6 my-1 pl-3 space-y-1">
              {item.children?.map((child) => (
                <AdminSidebarChildLink
                  key={child.path || child.code}
                  item={child}
                  pathname={pathname}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AdminSidebarLinkItem({ item, pathname }: AdminSidebarItemProps) {
  const isActive = isSidebarItemActive({ item, pathname });
  const itemPath = item.path || "";

  return (
    <Link
      href={itemPath}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden mb-1 ${
        isActive
          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-900/10 shadow-sm shadow-indigo-100/50 dark:shadow-none"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200"
      }`}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />
      )}

      <div
        className={`transition-colors duration-200 ${
          isActive
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
        }`}
      >
        {renderAdminSidebarIcon(item.icon, "w-5 h-5")}
      </div>
      <span>{item.name}</span>
    </Link>
  );
}

function AdminSidebarChildLink({ item, pathname }: AdminSidebarItemProps) {
  const childPath = item.path || "#";
  const isActive = isSidebarItemActive({
    item: { ...item, path: childPath },
    pathname,
  });

  return (
    <Link
      href={childPath}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group/child ${
        isActive
          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20"
          : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40"
      }`}
    >
      {item.icon ? (
        <span
          className={`transition-colors duration-200 ${
            isActive
              ? "text-indigo-600 dark:text-indigo-400"
              : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
          }`}
        >
          {renderAdminSidebarIcon(item.icon, "w-4 h-4")}
        </span>
      ) : (
        <span
          className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
            isActive
              ? "bg-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900/30"
              : "bg-gray-300 dark:bg-gray-600 group-hover/child:bg-gray-400"
          }`}
        />
      )}
      <span>{item.name}</span>
    </Link>
  );
}
