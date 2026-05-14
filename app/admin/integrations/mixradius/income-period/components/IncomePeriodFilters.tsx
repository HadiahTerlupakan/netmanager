"use client";

import { HiOutlineMagnifyingGlass } from "react-icons/hi2";

interface IncomePeriodFiltersProps {
  startDate: string;
  endDate: string;
  serviceType: string;
  paymentMethod: string;
  selectedGroup: string;
  selectedProject: string;
  search: string;
  groups: Array<{ id: string; name: string; siteId?: string }>;
  rabProjects: Array<{
    id: string;
    name: string;
    mixRadiusGroup?: { name: string };
  }>;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onServiceTypeChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
  onGroupChange: (value: string) => void;
  onProjectSelect: (value: string) => void;
  onSearchChange: (value: string) => void;
}

export default function IncomePeriodFilters(props: IncomePeriodFiltersProps) {
  const {
    startDate,
    endDate,
    serviceType,
    paymentMethod,
    selectedGroup,
    selectedProject,
    search,
    groups,
    rabProjects,
    onStartDateChange,
    onEndDateChange,
    onServiceTypeChange,
    onPaymentMethodChange,
    onGroupChange,
    onProjectSelect,
    onSearchChange,
  } = props;

  return (
    <div className="flex flex-col xl:flex-row gap-2 xl:items-center">
      <div className="flex flex-wrap gap-2 items-center flex-1">
        {/* Date Range */}
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2">
          <span className="text-xs text-gray-500 font-medium">Periode:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:ring-0 p-0 w-[110px]"
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:ring-0 p-0 w-[110px]"
          />
        </div>

        {/* Service Type */}
        <select
          value={serviceType}
          onChange={(e) => onServiceTypeChange(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[120px]"
        >
          <option value="">Semua Layanan</option>
          <option value="PPP">PPP / PPPoE</option>
          <option value="HOTSPOT">Hotspot</option>
        </select>

        {/* Payment Method */}
        <select
          value={paymentMethod}
          onChange={(e) => onPaymentMethodChange(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[120px]"
        >
          <option value="">Semua Metode</option>
          <option value="manual">Manual</option>
          <option value="online">Online</option>
        </select>

        {/* Group Filter */}
        <select
          value={selectedGroup}
          onChange={(e) => onGroupChange(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
        >
          <option value="all">Semua Site</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>

        {/* RAB Project Filter */}
        {rabProjects.length > 0 && (
          <select
            value={selectedProject}
            onChange={(e) => onProjectSelect(e.target.value)}
            className="border border-purple-300 dark:border-purple-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-[160px]"
          >
            <option value="">Pilih Proyek RAB</option>
            {rabProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}{" "}
                {project.mixRadiusGroup
                  ? `(${project.mixRadiusGroup.name})`
                  : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Search */}
      <div className="relative w-full xl:w-64">
        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Cari Invoice, User, Nama..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  );
}
