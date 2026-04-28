"use client";
import { clientLogger } from "@/lib/client-logger";

import { useState, useEffect, useCallback } from "react";
import { HiOutlineCalendarDays } from "react-icons/hi2";

interface LeaveBalanceData {
  leaveType: string;
  quota: number;
  used: number;
  remaining: number;
}

interface Props {
  userId: string;
  year?: number;
  workingHourMode?: string;
  onChange?: (quotas: Record<string, number>) => void;
  saveButtonLabel?: string;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CUTI: "Cuti Tahunan",
  SAKIT: "Sakit",
  IZIN: "Izin",
  LAINNYA: "Lainnya",
  TUKAR_LIBUR: "Tukar Libur",
};

export default function LeaveBalanceSettings({
  userId,
  year,
  workingHourMode,
  onChange: _onChange,
  saveButtonLabel = "Simpan Perubahan",
}: Props) {
  const currentYear = year || new Date().getFullYear();
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<LeaveBalanceData[]>([]);
  const [quotas, setQuotas] = useState<Record<string, number>>({});

  // Check if user is FLEXIBLE (skip fetching and rendering for FLEXIBLE users)
  const isFlexible = workingHourMode === "FLEXIBLE";

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/leave-balance?userId=${userId}&year=${currentYear}`,
      );
      const data = await res.json();
      if (res.ok) {
        const responseData = data.data || data;
        const fetchedBalances = responseData.balances || [];

        // If no balances returned, use defaults
        if (fetchedBalances.length === 0) {
          const defaultBalances: LeaveBalanceData[] = [
            { leaveType: "CUTI", quota: 12, used: 0, remaining: 12 },
            { leaveType: "SAKIT", quota: 6, used: 0, remaining: 6 },
            { leaveType: "IZIN", quota: 6, used: 0, remaining: 6 },
            { leaveType: "LAINNYA", quota: 3, used: 0, remaining: 3 },
            { leaveType: "TUKAR_LIBUR", quota: 365, used: 0, remaining: 365 },
          ];
          setBalances(defaultBalances);
          const initialQuotas: Record<string, number> = {};
          defaultBalances.forEach((b) => {
            initialQuotas[b.leaveType] = b.quota;
          });
          setQuotas(initialQuotas);
        } else {
          setBalances(fetchedBalances);
          // Initialize quotas from fetched data
          const initialQuotas: Record<string, number> = {};
          fetchedBalances.forEach((b: LeaveBalanceData) => {
            initialQuotas[b.leaveType] = b.quota;
          });
          setQuotas(initialQuotas);
        }
      } else {
        // On error, show defaults
        const defaultBalances: LeaveBalanceData[] = [
          { leaveType: "CUTI", quota: 12, used: 0, remaining: 12 },
          { leaveType: "SAKIT", quota: 6, used: 0, remaining: 6 },
          { leaveType: "IZIN", quota: 6, used: 0, remaining: 6 },
          { leaveType: "LAINNYA", quota: 3, used: 0, remaining: 3 },
          { leaveType: "TUKAR_LIBUR", quota: 365, used: 0, remaining: 365 },
        ];
        setBalances(defaultBalances);
      }
    } catch (error) {
      clientLogger.error("Error fetching leave balances:", error);
      // On error, show defaults
      const defaultBalances: LeaveBalanceData[] = [
        { leaveType: "CUTI", quota: 12, used: 0, remaining: 12 },
        { leaveType: "SAKIT", quota: 6, used: 0, remaining: 6 },
        { leaveType: "IZIN", quota: 6, used: 0, remaining: 6 },
        { leaveType: "LAINNYA", quota: 3, used: 0, remaining: 3 },
        { leaveType: "TUKAR_LIBUR", quota: 365, used: 0, remaining: 365 },
      ];
      setBalances(defaultBalances);
    } finally {
      setLoading(false);
    }
  }, [userId, currentYear]);

  useEffect(() => {
    if (!isFlexible) {
      fetchBalances();
    }
  }, [isFlexible, fetchBalances]);

  useEffect(() => {
    if (_onChange) {
      _onChange(quotas);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotas]);

  const handleQuotaChange = (type: string, value: number) => {
    setQuotas((prev) => ({ ...prev, [type]: value }));
  };

  // FLEXIBLE users don't need leave quotas - they are free to work anytime
  if (isFlexible) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 bg-linear-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
            <HiOutlineCalendarDays className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Kuota Cuti {currentYear}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Pengaturan jatah cuti tahunan
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                  Tipe Cuti
                </th>
                <th className="text-center py-3 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-24">
                  Kuota
                </th>
                <th className="text-center py-3 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-20">
                  Terpakai
                </th>
                <th className="text-center py-3 px-2 text-sm font-medium text-gray-600 dark:text-gray-400 w-20">
                  Sisa
                </th>
              </tr>
            </thead>
            <tbody>
              {balances.map((balance) => (
                <tr
                  key={balance.leaveType}
                  className="border-b border-gray-100 dark:border-gray-700/50"
                >
                  <td className="py-3 px-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {LEAVE_TYPE_LABELS[balance.leaveType] ||
                        balance.leaveType}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <input
                      type="number"
                      min="0"
                      max="365"
                      value={quotas[balance.leaveType] ?? balance.quota}
                      onChange={(e) =>
                        handleQuotaChange(
                          balance.leaveType,
                          parseInt(e.target.value) || 0,
                        )
                      }
                      className="w-16 text-center py-1 px-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="text-gray-600 dark:text-gray-400">
                      {balance.used}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span
                      className={`font-medium ${balance.remaining <= 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
                    >
                      {balance.remaining}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 italic">
          * Kuota akan tersimpan saat menekan tombol &quot;{saveButtonLabel}
          &quot;
        </p>
      </div>
    </div>
  );
}
