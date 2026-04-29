"use client";

import React from "react";
import { formatCurrency } from "@/lib/utils";
import type { RABProject } from "./rabTypes";
import { getRabItemCategoryLabel } from "./rabView.helpers";

interface RABItemsTableProps {
  project: RABProject;
}

type RABItem = RABProject["items"][number] & {
  expenseCategory?: { name: string; parent?: { name: string } };
};

type WbsGroup = { id: string; name: string; order: number };

/** Menampilkan tabel item, grup WBS, dan termin pencairan RAB. */
export default function RABItemsTable({ project }: RABItemsTableProps) {
  const hasWbs = Boolean(project.wbsGroups && project.wbsGroups.length > 0);
  const groups = [...(project.wbsGroups || [])].sort(
    (left: WbsGroup, right: WbsGroup) => left.order - right.order,
  );
  const ungroupedItems = project.items.filter(
    (item) => !(item as RABItem & { wbsId?: string }).wbsId && !item.wbsGroupId,
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            {[
              "Tipe",
              "Nama Item",
              "Kategori",
              "Qty",
              "Harga Satuan",
              "Total",
            ].map((label, index) => (
              <th
                key={label}
                scope="col"
                className={`px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 ${index >= 3 ? "text-right" : "text-left"}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          {project.items.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-6 py-8 text-center text-sm text-gray-500"
              >
                Tidak ada item pada RAB ini.
              </td>
            </tr>
          ) : hasWbs ? (
            <>
              {groups.map((group) => (
                <RABWbsGroupRows
                  key={group.id}
                  group={group}
                  project={project}
                />
              ))}
              {ungroupedItems.length > 0 && (
                <>
                  <RABGroupHeaderRow
                    title="Lain-lain (Belum Digrup)"
                    total={ungroupedItems.reduce(
                      (sum, item) => sum + Number(item.totalPrice),
                      0,
                    )}
                    accentClass="border-gray-400 text-gray-700 dark:text-gray-400"
                  />
                  {ungroupedItems.map((item) => (
                    <RABItemRows
                      key={item.id}
                      item={item as RABItem}
                      isNested
                    />
                  ))}
                </>
              )}
            </>
          ) : (
            project.items.map((item) => (
              <RABItemRows key={item.id} item={item as RABItem} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Menampilkan header subtotal untuk grup item RAB. */
function RABGroupHeaderRow({
  title,
  total,
  accentClass,
}: {
  title: string;
  total: number;
  accentClass: string;
}) {
  return (
    <tr className="bg-gray-50/80 dark:bg-gray-900/40">
      <td
        colSpan={5}
        className={`border-l-4 px-6 py-3 text-xs font-black uppercase tracking-wider ${accentClass}`}
      >
        {title}
      </td>
      <td className="px-6 py-3 text-right text-sm font-black text-indigo-700 dark:text-indigo-400">
        {formatCurrency(total)}
      </td>
    </tr>
  );
}

/** Menampilkan seluruh baris untuk satu grup WBS. */
function RABWbsGroupRows({
  group,
  project,
}: {
  group: WbsGroup;
  project: RABProject;
}) {
  const groupItems = project.items.filter((item) => {
    const wbsId = (item as RABItem & { wbsId?: string }).wbsId;
    return wbsId === group.id || item.wbsGroupId === group.id;
  });

  if (groupItems.length === 0) return null;

  const groupTotal = groupItems.reduce(
    (sum, item) => sum + Number(item.totalPrice),
    0,
  );

  return (
    <>
      <RABGroupHeaderRow
        title={group.name}
        total={groupTotal}
        accentClass="border-indigo-500 text-gray-700 dark:text-gray-300"
      />
      {groupItems.map((item) => (
        <RABItemRows key={item.id} item={item as RABItem} isNested />
      ))}
    </>
  );
}

/** Menampilkan baris item utama beserta termin pencairannya. */
function RABItemRows({
  item,
  isNested = false,
}: {
  item: RABItem;
  isNested?: boolean;
}) {
  return (
    <>
      <tr className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
        <td className="whitespace-nowrap px-6 py-3 text-sm">
          <ExpenseTypeBadge expenseType={item.expenseType || "CAPEX"} />
        </td>
        <td
          className={`px-6 py-3 text-sm font-medium text-gray-900 dark:text-white ${isNested ? "pl-8" : ""}`}
        >
          {item.name}
        </td>
        <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-500 dark:text-gray-400">
          {getRabItemCategoryLabel(item)}
        </td>
        <td className="whitespace-nowrap px-6 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
          {item.quantity}
        </td>
        <td className="whitespace-nowrap px-6 py-3 text-right text-sm text-gray-500 dark:text-gray-400">
          {formatCurrency(Number(item.unitPrice))}
        </td>
        <td className="whitespace-nowrap px-6 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
          {formatCurrency(Number(item.totalPrice))}
        </td>
      </tr>
      {item.disbursements && item.disbursements.length > 0 && (
        <RABDisbursementRow
          disbursements={item.disbursements}
          isNested={isNested}
        />
      )}
    </>
  );
}

/** Menampilkan badge tipe biaya item RAB. */
function ExpenseTypeBadge({ expenseType }: { expenseType: string }) {
  const badgeClass =
    expenseType === "CAPEX"
      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
      : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";

  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${badgeClass}`}>
      {expenseType}
    </span>
  );
}

/** Menampilkan tabel termin pencairan untuk item RAB. */
function RABDisbursementRow({
  disbursements,
  isNested,
}: {
  disbursements: NonNullable<RABItem["disbursements"]>;
  isNested: boolean;
}) {
  const paddingClass = isNested ? "pl-12" : "pl-6";

  return (
    <tr className="bg-indigo-50/30 dark:bg-indigo-900/10">
      <td colSpan={6} className="px-6 py-3">
        <div
          className={`${paddingClass} border-l-2 border-indigo-300 dark:border-indigo-700`}
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Termin Pencairan Vendor
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-indigo-100 dark:divide-indigo-900/30">
              <thead>
                <tr>
                  {[
                    "Keterangan",
                    "Est. Tanggal",
                    "Persentase",
                    "Nominal",
                    "Status",
                  ].map((label, index) => (
                    <th
                      key={label}
                      className={`py-2 text-[9px] font-bold uppercase text-indigo-400 ${index < 2 ? "text-left" : index === 4 ? "text-center" : "text-right"}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50 dark:divide-indigo-900/20">
                {disbursements.map((disbursement, index) => (
                  <tr key={disbursement.id}>
                    <td className="py-1.5 text-xs font-medium text-indigo-900 dark:text-indigo-300">
                      {disbursement.name || `Termin ${index + 1}`}
                    </td>
                    <td className="py-1.5 text-xs text-indigo-500">
                      {disbursement.estimatedDate
                        ? new Date(
                            disbursement.estimatedDate,
                          ).toLocaleDateString("id-ID")
                        : "-"}
                    </td>
                    <td className="py-1.5 text-right text-xs font-bold text-indigo-900 dark:text-indigo-300">
                      {disbursement.percentage}%
                    </td>
                    <td className="py-1.5 text-right text-xs font-medium text-indigo-700 dark:text-indigo-400">
                      {formatCurrency(Number(disbursement.amount))}
                    </td>
                    <td className="py-1.5 text-center">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-[8px] font-bold uppercase ${disbursement.isPaid ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}
                      >
                        {disbursement.isPaid ? "Cair" : "Menunggu"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
}
