import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";

import { FinanceExpenseQueryService } from "@/modules/finance";
import { getMixRadiusService, MixRadiusConfigError } from "./MixRadiusService";

const TOP_EXPENSE_LIMIT = 5;
const EMPTY_TRANSACTION_COUNT = "0";
const DEFAULT_NUMBER = 0;

export class MixRadiusProfitLossService {
  constructor(
    private readonly expenseRepository = new FinanceExpenseQueryService(),
  ) {}

  /** Build MixRadius profit-loss report from remote income and local expenses. */
  async getReport(input: {
    startDate?: string | null;
    endDate?: string | null;
    siteId?: string | null;
  }) {
    const { startDate, endDate } = this.resolveDateRange(input);
    const siteId = input.siteId || undefined;
    const service = getMixRadiusService();
    const [expenses, incomeSummary, profitData] = await Promise.all([
      this.expenseRepository.findProfitLossExpenses({
        startDate,
        endDate,
        siteId,
      }),
      service.fetchIncomeSummary({
        startDate: input.startDate || undefined,
        endDate: input.endDate || undefined,
        siteId,
      }),
      service.fetchProfitReport(siteId),
    ]);

    const year = startDate.getFullYear();
    const monthlyMap = new Map<string, ProfitMonthAggregate>();
    const trendMap = new Map<string, TrendAggregate>();

    this.addIncomeToAggregates(monthlyMap, trendMap, profitData, year);
    await this.addYearlyExpenses(monthlyMap, trendMap, year, siteId);

    const totalIncome = this.parseIdr(incomeSummary.totalPlusPpn);
    const totalFees = this.parseIdr(incomeSummary.feeSeller);
    const totalTransactions = Number.parseInt(
      incomeSummary.totalTransactions || EMPTY_TRANSACTION_COUNT,
      10,
    );
    const totalExpense = expenses.reduce(
      (sum, item) => sum + Number(item.amount),
      DEFAULT_NUMBER,
    );

    return {
      summary: {
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalFees - totalExpense,
        totalTransactions,
        totalFees,
        totalTax: DEFAULT_NUMBER,
      },
      trend: Array.from(trendMap.entries())
        .map(([date, value]) => ({ date, ...value }))
        .sort((left, right) => left.date.localeCompare(right.date)),
      monthlyBreakdown: Array.from(monthlyMap.entries())
        .map(([month, value]) => ({
          month,
          income: value.income,
          expense: value.expense,
          transactions: value.transactions,
          fees: value.fees,
          sellerFees: DEFAULT_NUMBER,
          tax: DEFAULT_NUMBER,
          net: value.income - value.fees - value.expense,
        }))
        .sort((left, right) => right.month.localeCompare(left.month)),
      topExpenses: this.buildTopExpenses(expenses),
    };
  }

  /** Build empty fallback payload for MixRadius config errors. */
  getConfigErrorResponse(error: MixRadiusConfigError): {
    error: string;
    isConfigError: boolean;
    summary: {
      totalIncome: number;
      totalExpense: number;
      netProfit: number;
      totalTransactions: number;
      totalFees: number;
      totalTax: number;
    };
    trend: Array<{ date: string; income: number; expense: number }>;
    monthlyBreakdown: Array<{
      month: string;
      income: number;
      expense: number;
      transactions: number;
      fees: number;
      sellerFees: number;
      tax: number;
      net: number;
    }>;
    topExpenses: Array<{ name: string; amount: number }>;
  } {
    return {
      error: error.message,
      isConfigError: true,
      summary: {
        totalIncome: DEFAULT_NUMBER,
        totalExpense: DEFAULT_NUMBER,
        netProfit: DEFAULT_NUMBER,
        totalTransactions: DEFAULT_NUMBER,
        totalFees: DEFAULT_NUMBER,
        totalTax: DEFAULT_NUMBER,
      },
      trend: [],
      monthlyBreakdown: [],
      topExpenses: [],
    };
  }

  private resolveDateRange(input: {
    startDate?: string | null;
    endDate?: string | null;
  }) {
    if (input.startDate && input.endDate) {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      return {
        startDate: toStartOfDay(startDate),
        endDate: toEndOfDay(endDate),
      };
    }

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: toStartOfDay(startDate),
      endDate: toEndOfDay(new Date()),
    };
  }

  private parseIdr(value: string) {
    if (!value) {
      return DEFAULT_NUMBER;
    }

    return Number.parseFloat(value.replace(/\./g, "").replace(",", ".") || "0");
  }

  private addIncomeToAggregates(
    monthlyMap: Map<string, ProfitMonthAggregate>,
    trendMap: Map<string, TrendAggregate>,
    profitData: { income: number[]; transactions: number[] },
    year: number,
  ) {
    profitData.income.forEach((income, index) => {
      const transactions = profitData.transactions[index] || DEFAULT_NUMBER;

      if (income === 0 && transactions === 0) {
        return;
      }

      const monthNumber = index + 1;
      const monthKey = `${year}-${String(monthNumber).padStart(2, "0")}`;
      const monthData = monthlyMap.get(monthKey) || this.createMonthAggregate();
      monthData.income += income;
      monthData.transactions += transactions;
      monthlyMap.set(monthKey, monthData);

      const trendKey = `${monthKey}-01`;
      const trendData = trendMap.get(trendKey) || this.createTrendAggregate();
      trendData.income += income;
      trendMap.set(trendKey, trendData);
    });
  }

  private async addYearlyExpenses(
    monthlyMap: Map<string, ProfitMonthAggregate>,
    trendMap: Map<string, TrendAggregate>,
    year: number,
    siteId?: string,
  ) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);
    const expenses = await this.expenseRepository.findYearlyProfitLossExpenses({
      startDate,
      endDate,
      siteId,
    });

    expenses.forEach((expense) => {
      const monthKey = expense.date.toISOString().slice(0, 7);
      const monthData = monthlyMap.get(monthKey) || this.createMonthAggregate();
      monthData.expense += Number(expense.amount);
      monthlyMap.set(monthKey, monthData);

      const trendKey = `${monthKey}-01`;
      const trendData = trendMap.get(trendKey) || this.createTrendAggregate();
      trendData.expense += Number(expense.amount);
      trendMap.set(trendKey, trendData);
    });
  }

  private buildTopExpenses(
    expenses: Array<{
      amount: bigint;
      category: string;
      description: string | null;
      expenseCategory: { name: string } | null;
    }>,
  ) {
    const expenseMap = new Map<string, number>();

    expenses.forEach((expense) => {
      let name =
        expense.expenseCategory?.name ||
        expense.description ||
        expense.category ||
        "Uncategorized";

      if ((name === "OPEX" || name === "CAPEX") && expense.description) {
        name = expense.description;
      }

      expenseMap.set(
        name,
        (expenseMap.get(name) || 0) + Number(expense.amount),
      );
    });

    return Array.from(expenseMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, TOP_EXPENSE_LIMIT);
  }

  private createMonthAggregate(): ProfitMonthAggregate {
    return {
      income: DEFAULT_NUMBER,
      expense: DEFAULT_NUMBER,
      transactions: DEFAULT_NUMBER,
      fees: DEFAULT_NUMBER,
      sellerFees: DEFAULT_NUMBER,
      tax: DEFAULT_NUMBER,
    };
  }

  private createTrendAggregate(): TrendAggregate {
    return {
      income: DEFAULT_NUMBER,
      expense: DEFAULT_NUMBER,
    };
  }
}

type ProfitMonthAggregate = {
  income: number;
  expense: number;
  transactions: number;
  fees: number;
  sellerFees: number;
  tax: number;
};

type TrendAggregate = {
  income: number;
  expense: number;
};
