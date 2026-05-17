"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { clientLogger } from "@/lib/client-logger";

import {
  calculateIncomePeriodCumulativeRoi,
  FETCH_ALL_LIMIT,
  type IncomePeriodExpenseItem,
} from "../calculations";
import type { FeeConfig } from "../FeeConfigurationModal";

interface RABProject {
  id: string;
  name: string;
  description?: string;
  siteId?: string;
  mixRadiusGroupId?: string;
  site?: { name: string };
  mixRadiusGroup?: { name: string };
  projectedRevenue: number;
  projectedOpex: number;
  targetSubscribers?: number;
  arpu?: number;
  growthType?: "LINEAR" | "PERCENTAGE" | "CUSTOM";
  growthSettings?: unknown;
  startDate?: string;
  status: string;
  items: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    expenseType?: "CAPEX" | "OPEX";
  }>;
  createdAt: string;
}

interface UseRoiTrackingParams {
  rabProject: RABProject | null;
  feeConfig: FeeConfig;
  groupsLength: number;
}

/** Manages ROI/BEP cumulative tracking state and calculations. */
export function useRoiTracking({
  rabProject,
  feeConfig,
  groupsLength,
}: UseRoiTrackingParams) {
  const [cumulativeRevenue, setCumulativeRevenue] = useState(0);
  const [cumulativeExpenses, setCumulativeExpenses] = useState(0);
  const [cumulativeNetIncome, setCumulativeNetIncome] = useState(0);
  const [cumulativeGatewayFee, setCumulativeGatewayFee] = useState(0);
  const [projectMonthsElapsed, setProjectMonthsElapsed] = useState(0);
  const [cumCapexFromRab, setCumCapexFromRab] = useState(0);
  const [cumCapexUmum, setCumCapexUmum] = useState(0);
  const [cumOpexAktual, setCumOpexAktual] = useState(0);
  const [cumOpexUmum, setCumOpexUmum] = useState(0);
  const [cumOpexProyeksi, setCumOpexProyeksi] = useState(0);
  const [cumDepreciation, setCumDepreciation] = useState(0);
  const [roiLoading, setRoiLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calcROI = useCallback(
    async (project: RABProject, fees: FeeConfig, totalGroups: number) => {
      setRoiLoading(true);

      try {
        const startDate = new Date(project.startDate!);
        const now = new Date();

        const projectStartStr = startDate.toISOString().split("T")[0];
        const nowStr = now.toISOString().split("T")[0];

        const months =
          (now.getFullYear() - startDate.getFullYear()) * 12 +
          (now.getMonth() - startDate.getMonth());

        setProjectMonthsElapsed(months);

        const [revenueRes, specificExpensesRes, generalExpensesRes] =
          await Promise.all([
            fetch(
              `/api/integrations/mixradius/reports/period?start=0&length=${FETCH_ALL_LIMIT}&search=&sortBy=renewed_on&sortDir=desc&fdate=${projectStartStr}&tdate=${nowStr}&groupId=${project.mixRadiusGroupId}`,
            ),
            fetch(
              `/api/finance/expenses?startDate=${projectStartStr}&endDate=${nowStr}&mixRadiusGroupId=${project.mixRadiusGroupId}`,
            ),
            fetch(
              `/api/finance/expenses?startDate=${projectStartStr}&endDate=${nowStr}&scope=general`,
            ),
          ]);

        if (!revenueRes.ok) {
          clientLogger.error(
            "Failed to fetch revenue data for ROI calculation",
          );
          return;
        }

        const revenueJson = await revenueRes.json();
        const revenueData = revenueJson?.data;

        if (!revenueData?.data) {
          clientLogger.warn("No revenue data available for ROI calculation");
          return;
        }

        const specificExpenses: IncomePeriodExpenseItem[] =
          specificExpensesRes.ok
            ? ((await specificExpensesRes.json())?.data ?? [])
            : [];

        const generalExpenses: IncomePeriodExpenseItem[] = generalExpensesRes.ok
          ? ((await generalExpensesRes.json())?.data ?? [])
          : [];

        const roi = calculateIncomePeriodCumulativeRoi({
          summaryProfit: revenueData.summary?.profit,
          summarySellerFee: revenueData.summary?.feeSeller,
          records: revenueData.data,
          feeConfig: fees,
          specificExpenses,
          generalExpenses,
          rabItems: project.items,
          months,
          totalGroups,
        });

        setCumulativeRevenue(roi.revenue);
        setCumulativeExpenses(roi.totalExpenses);
        setCumulativeNetIncome(roi.operatingProfit);
        setCumulativeGatewayFee(roi.gatewayFee);
        setCumCapexFromRab(roi.capexFromRab);
        setCumCapexUmum(roi.capexUmum);
        setCumOpexAktual(roi.opexAktual);
        setCumOpexUmum(roi.opexUmum);
        setCumOpexProyeksi(roi.opexProyeksi);
        setCumDepreciation(roi.depreciation);
      } catch (error) {
        clientLogger.error("Error calculating ROI", error);
      } finally {
        setRoiLoading(false);
      }
    },
    [],
  );

  // --- Reset semua nilai cumulative saat rabProject hilang/invalid (derived comparator) ---
  const isInvalidProject =
    !rabProject || !rabProject.startDate || !rabProject.mixRadiusGroupId;
  const [prevInvalidProject, setPrevInvalidProject] =
    useState(isInvalidProject);
  if (prevInvalidProject !== isInvalidProject) {
    setPrevInvalidProject(isInvalidProject);
    if (isInvalidProject) {
      setCumulativeRevenue(0);
      setCumulativeExpenses(0);
      setCumulativeNetIncome(0);
      setCumulativeGatewayFee(0);
      setProjectMonthsElapsed(0);
      setCumCapexFromRab(0);
      setCumCapexUmum(0);
      setCumOpexAktual(0);
      setCumOpexUmum(0);
      setCumOpexProyeksi(0);
      setCumDepreciation(0);
    }
  }

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (isInvalidProject) {
      // Reset sudah ditangani via comparator di atas
      return;
    }

    debounceRef.current = setTimeout(() => {
      calcROI(rabProject!, feeConfig, groupsLength);
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [rabProject, feeConfig, groupsLength, calcROI, isInvalidProject]);

  return {
    cumulativeRevenue,
    cumulativeExpenses,
    cumulativeNetIncome,
    cumulativeGatewayFee,
    projectMonthsElapsed,
    cumCapexFromRab,
    cumCapexUmum,
    cumOpexAktual,
    cumOpexUmum,
    cumOpexProyeksi,
    cumDepreciation,
    roiLoading,
  };
}
