import { summaryToneClasses } from "./constants";
import type { TopWorkOrderCustomer, WorkOrderSummaryCard } from "./summary";

interface WorkOrderSummarySectionProps {
  summaryCards: WorkOrderSummaryCard[];
  visibleTopCustomers: TopWorkOrderCustomer[];
  onSelectTopCustomer: (customerName: string) => void;
}

/** Tampilkan kartu ringkasan dan daftar top customer work order. */
export function WorkOrderSummarySection(props: WorkOrderSummarySectionProps) {
  const { summaryCards, visibleTopCustomers, onSelectTopCustomer } = props;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {summaryCards.map((card) => (
          <div
            key={card.id}
            className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${summaryToneClasses[card.tone]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide opacity-80">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-black leading-none">
                  {card.value.toLocaleString("id-ID")}
                </p>
              </div>
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold dark:bg-white/10">
                WO
              </span>
            </div>
            <p className="mt-3 text-xs font-medium opacity-75">
              {card.description}
            </p>
          </div>
        ))}
      </div>

      {visibleTopCustomers.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-gray-800">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Top Customer
              </p>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Nama customer yang paling sering muncul
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Berdasarkan filter aktif
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {visibleTopCustomers.map((customer, index) => (
              <button
                key={`${customer.name}-${customer.phone ?? "no-phone"}`}
                type="button"
                onClick={() => onSelectTopCustomer(customer.name)}
                className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-sky-500/40"
                title={`Filter WO ${customer.name}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-black text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                    #{index + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {customer.count.toLocaleString("id-ID")} WO
                  </span>
                </div>
                <p
                  className="mt-3 truncate text-sm font-bold text-slate-900 dark:text-white"
                  title={customer.name}
                >
                  {customer.name}
                </p>
                <p
                  className="mt-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400"
                  title={customer.phone ?? undefined}
                >
                  {customer.phone || "No. telp belum ada"}
                </p>
                {customer.siteName && (
                  <p
                    className="mt-2 truncate text-xs font-semibold text-slate-500 dark:text-slate-400"
                    title={customer.siteName}
                  >
                    Site: {customer.siteName}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
