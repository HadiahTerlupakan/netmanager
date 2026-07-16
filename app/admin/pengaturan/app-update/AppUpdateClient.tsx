"use client";

import { useState } from "react";
import { AppReleasesTab } from "./AppReleasesTab";
import { OtaUpdatesTab } from "./OtaUpdatesTab";

type TabKey = "ota" | "releases";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ota", label: "OTA (JS Bundle)" },
  { key: "releases", label: "Rilis APK (Play Store)" },
];

export function AppUpdateClient() {
  const [activeTab, setActiveTab] = useState<TabKey>("ota");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Update Aplikasi
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Kelola update aplikasi mobile — OTA untuk perubahan JS, dan rilis APK
          untuk perubahan native yang butuh Play Store.
        </p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === "ota" && <OtaUpdatesTab />}
      {activeTab === "releases" && <AppReleasesTab />}
    </div>
  );
}
