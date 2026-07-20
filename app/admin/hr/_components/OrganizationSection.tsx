"use client";

import { HiOutlineBuildingOffice } from "react-icons/hi2";
import MultiSiteSelect from "./MultiSiteSelect";
import type {
  ReferenceDepartment,
  ReferenceSite,
} from "@/app/admin/users/lib/userDetailApi";

interface SelectedSite {
  siteId: string;
  isPrimary: boolean;
}

interface OrganizationSectionProps {
  departments: ReferenceDepartment[];
  sites: ReferenceSite[];
  selectedSites: SelectedSite[];
  setSelectedSites: (sites: SelectedSite[]) => void;
  formData: { departmentId: string };
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
}

/** Section Organisasi: departemen + multi-site selection. */
export function OrganizationSection({
  departments,
  sites,
  selectedSites,
  setSelectedSites,
  formData,
  handleChange,
}: OrganizationSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <HiOutlineBuildingOffice className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Organisasi
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Penempatan departemen dan lokasi kerja
            </p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Departemen
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <HiOutlineBuildingOffice className="h-5 w-5 text-gray-400" />
              </div>
              <select
                name="departmentId"
                value={formData.departmentId}
                onChange={handleChange}
                className="w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Pilih Departemen</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <MultiSiteSelect
              sites={sites}
              selectedSites={selectedSites}
              onChange={setSelectedSites}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
