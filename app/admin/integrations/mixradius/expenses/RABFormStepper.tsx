import type { ComponentType, SVGProps } from "react";
import { HiOutlineCheck } from "react-icons/hi2";

type RABFormStep<T extends string> = {
  id: T;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

interface RABFormStepperProps<T extends string> {
  activeTab: T;
  tabs: RABFormStep<T>[];
  onTabChange: (tab: T) => void;
}

/** Menampilkan navigasi langkah form RAB. */
export function RABFormStepper<T extends string>({
  activeTab,
  tabs,
  onTabChange,
}: RABFormStepperProps<T>) {
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

  return (
    <div className="flex items-center justify-between mb-8 px-4 relative">
      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -translate-y-1/2 z-0 hidden sm:block" />

      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const isComplete = activeIndex > index;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className="relative z-10 flex flex-col items-center group"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                isActive
                  ? "bg-blue-600 border-blue-600 text-white shadow-lg scale-110"
                  : isComplete
                    ? "bg-green-500 border-green-500 text-white"
                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 group-hover:border-blue-400"
              }`}
            >
              {isComplete ? (
                <HiOutlineCheck className="w-6 h-6" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
            </div>
            <span
              className={`mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${
                isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-400"
              }`}
            >
              {tab.label.split(" ")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
