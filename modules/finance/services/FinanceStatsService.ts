import { PaymentRepository } from "../repositories/PaymentRepository";
import { ExpenseRepository } from "../repositories/ExpenseRepository";
import { Prisma } from "../repositories/prisma-boundary";
import { startOfDay, endOfDay } from "date-fns";

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface MonthlyBreakdown {
  period: string;
  transactionCount: number;
  revenue: number;
  expenses: number;
  netProfit: number;
  tax: number;
}

export class FinanceStatsService {
  private paymentRepo: PaymentRepository;
  private expenseRepo: ExpenseRepository;

  constructor() {
    this.paymentRepo = new PaymentRepository();
    this.expenseRepo = new ExpenseRepository();
  }

  async getStats(options: {
    startDate?: string;
    endDate?: string;
    type?: string;
  }) {
    const dateRange = this.calculateDateRange(options);

    const [payments, expenses] = await Promise.all([
      this.getPayments(dateRange),
      this.getExpenses(dateRange),
    ]);

    const totalRevenue = payments.reduce(
      (acc, curr) => acc + Number(curr.amount),
      0,
    );
    const totalExpenses = expenses.reduce(
      (acc, curr) => acc + Number(curr.amount),
      0,
    );
    const netProfit = totalRevenue - totalExpenses;

    const history = this.getMonthlyBreakdown(payments, expenses, dateRange);

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      details: {
        paymentCount: payments.length,
        expenseCount: expenses.length,
      },
      history,
    };
  }

  private calculateDateRange(options: {
    startDate?: string;
    endDate?: string;
  }): DateRange {
    let startDate = startOfDay(new Date());
    let endDate = endOfDay(new Date());

    if (options.startDate && options.endDate) {
      const start = new Date(options.startDate);
      const end = new Date(options.endDate);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        startDate = startOfDay(start);
        endDate = endOfDay(end);
      }
    }

    return { startDate, endDate };
  }

  private async getPayments(dateRange: DateRange) {
    return this.paymentRepo.findManyByDateRange(
      dateRange.startDate,
      dateRange.endDate,
    );
  }

  private async getExpenses(dateRange: DateRange) {
    try {
      return await this.expenseRepo.findManyWithRelations({
        date: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      });
    } catch {
      return [];
    }
  }

  private getMonthlyBreakdown(
    payments: { paymentDate: Date; amount: number | bigint | Prisma.Decimal }[],
    expenses: { date: Date; amount: number | bigint | Prisma.Decimal }[],
    dateRange: DateRange,
  ): MonthlyBreakdown[] {
    const months: MonthlyBreakdown[] = [];
    const currentDate = new Date(dateRange.startDate);

    while (currentDate <= dateRange.endDate) {
      const monthStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      );
      const monthEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
      );

      const monthPayments = payments.filter((p) => {
        const d = new Date(p.paymentDate);
        return d >= monthStart && d <= monthEnd;
      });

      const monthExpenses = expenses.filter((e) => {
        const d = new Date(e.date);
        return d >= monthStart && d <= monthEnd;
      });

      const revenue = monthPayments.reduce(
        (acc, curr) => acc + Number(curr.amount),
        0,
      );
      const expense = monthExpenses.reduce(
        (acc, curr) => acc + Number(curr.amount),
        0,
      );

      months.push({
        period: monthStart.toISOString(),
        transactionCount: monthPayments.length + monthExpenses.length,
        revenue,
        expenses: expense,
        netProfit: revenue - expense,
        tax: 0,
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return months;
  }
}
