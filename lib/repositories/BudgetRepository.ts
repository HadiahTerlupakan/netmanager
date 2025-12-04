import { PrismaClient } from '@prisma/client';
import type { Budget, BudgetCategory, BudgetAlert, CashFlowForecast } from '@prisma/client';
import type {
    IBudgetRepository,
    CreateBudgetDTO,
    UpdateBudgetDTO,
    BudgetFilter,
    BudgetWithCategory,
    BudgetAnalysis,
    CreateBudgetCategoryDTO,
    CreateForecastDTO,
} from './IBudgetRepository';

export class BudgetRepository implements IBudgetRepository {
    constructor(private prisma: PrismaClient) { }

    // ============================================
    // BUDGET CRUD
    // ============================================

    async createBudget(data: CreateBudgetDTO): Promise<Budget> {
        return await this.prisma.budget.create({
            data: {
                ...data,
                budgetAmount: BigInt(data.budgetAmount),
            },
        });
    }

    async getBudgets(
        filter: BudgetFilter,
        page = 1,
        limit = 50
    ): Promise<{
        data: BudgetWithCategory[];
        total: number;
        page: number;
        limit: number;
    }> {
        const where: any = {};

        if (filter.year) {
            where.year = filter.year;
        }

        if (filter.month) {
            where.month = filter.month;
        }

        if (filter.categoryId) {
            where.categoryId = filter.categoryId;
        }

        if (filter.department) {
            where.department = filter.department;
        }

        if (filter.status) {
            where.status = filter.status;
        }

        // Filter by type (OPEX or CAPEX)
        if (filter.type) {
            where.category = {
                type: filter.type,
            };
        }

        const [data, total] = await Promise.all([
            this.prisma.budget.findMany({
                where,
                include: {
                    category: true,
                    alerts: {
                        where: { isRead: false },
                        orderBy: { createdAt: 'desc' },
                    },
                },
                orderBy: [{ year: 'desc' }, { month: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.budget.count({ where }),
        ]);

        return { data, total, page, limit };
    }

    async getBudgetById(id: string): Promise<BudgetWithCategory | null> {
        return await this.prisma.budget.findUnique({
            where: { id },
            include: {
                category: true,
                alerts: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
    }

    async updateBudget(id: string, data: UpdateBudgetDTO): Promise<Budget> {
        const updateData: any = { ...data };

        // Convert BigInt fields if present
        if (data.budgetAmount !== undefined) {
            updateData.budgetAmount = BigInt(data.budgetAmount);
        }
        if (data.actualAmount !== undefined) {
            updateData.actualAmount = BigInt(data.actualAmount);

            // Calculate variance when updating actual amount
            const budget = await this.prisma.budget.findUnique({
                where: { id },
                select: { budgetAmount: true },
            });

            if (budget) {
                const actualAmount = BigInt(data.actualAmount);
                const budgetAmount = budget.budgetAmount;
                const variance = actualAmount - budgetAmount;
                const variancePercent = Number(variance * BigInt(100) / budgetAmount);

                updateData.variance = variance;
                updateData.variancePercent = variancePercent;

                // Create alerts if necessary
                await this.checkAndCreateAlerts(id, budgetAmount, actualAmount, variancePercent);
            }
        }

        return await this.prisma.budget.update({
            where: { id },
            data: updateData,
        });
    }

    async deleteBudget(id: string): Promise<void> {
        await this.prisma.budget.delete({
            where: { id },
        });
    }

    async approveBudget(id: string, approvedBy: string): Promise<Budget> {
        return await this.prisma.budget.update({
            where: { id },
            data: {
                status: 'APPROVED',
                approvedBy,
                approvedAt: new Date(),
            },
        });
    }

    // ============================================
    // BUDGET ANALYSIS
    // ============================================

    async getBudgetAnalysis(month: number, year: number): Promise<BudgetAnalysis> {
        const budgets = await this.prisma.budget.findMany({
            where: { month, year },
            include: {
                category: true,
            },
        });

        const budgetsByCategory = budgets.map((budget) => {
            const utilizationPercent =
                budget.budgetAmount > 0
                    ? Number((budget.actualAmount * BigInt(100)) / budget.budgetAmount)
                    : 0;

            let status: 'under' | 'ok' | 'warning' | 'exceeded';
            if (utilizationPercent < 70) {
                status = 'under';
            } else if (utilizationPercent < 90) {
                status = 'ok';
            } else if (utilizationPercent < 100) {
                status = 'warning';
            } else {
                status = 'exceeded';
            }

            return {
                category: budget.category,
                budget,
                utilizationPercent,
                status,
            };
        });

        const totalBudget = budgets.reduce((sum, b) => sum + b.budgetAmount, BigInt(0));
        const totalActual = budgets.reduce((sum, b) => sum + b.actualAmount, BigInt(0));
        const totalVariance = totalActual - totalBudget;
        const overallUtilizationPercent =
            totalBudget > 0 ? Number((totalActual * BigInt(100)) / totalBudget) : 0;

        return {
            year,
            month,
            budgetsByCategory,
            totalBudget,
            totalActual,
            totalVariance,
            overallUtilizationPercent,
        };
    }

    async updateActualAmount(budgetId: string, amount: bigint): Promise<Budget> {
        return await this.updateBudget(budgetId, {
            actualAmount: amount,
        });
    }

    // ============================================
    // BUDGET CATEGORIES
    // ============================================

    async createCategory(data: CreateBudgetCategoryDTO): Promise<BudgetCategory> {
        return await this.prisma.budgetCategory.create({
            data,
        });
    }

    async getCategories(
        type?: string,
        includeInactive = false
    ): Promise<BudgetCategory[]> {
        const where: any = {};

        if (type) {
            where.type = type;
        }

        if (!includeInactive) {
            where.isActive = true;
        }

        return await this.prisma.budgetCategory.findMany({
            where,
            include: {
                parent: true,
                children: true,
            },
            orderBy: [{ type: 'asc' }, { code: 'asc' }],
        });
    }

    async getCategoryById(id: string): Promise<BudgetCategory | null> {
        return await this.prisma.budgetCategory.findUnique({
            where: { id },
            include: {
                parent: true,
                children: true,
            },
        });
    }

    // ============================================
    // BUDGET ALERTS
    // ============================================

    async createAlert(
        budgetId: string,
        alertType: string,
        threshold: number,
        message: string
    ): Promise<BudgetAlert> {
        // Check if similar alert already exists
        const existingAlert = await this.prisma.budgetAlert.findFirst({
            where: {
                budgetId,
                alertType,
                isRead: false,
            },
        });

        if (existingAlert) {
            // Update existing alert
            return await this.prisma.budgetAlert.update({
                where: { id: existingAlert.id },
                data: { message, threshold },
            });
        }

        return await this.prisma.budgetAlert.create({
            data: {
                budgetId,
                alertType,
                threshold,
                message,
            },
        });
    }

    async getAlerts(budgetId?: string, isRead?: boolean): Promise<BudgetAlert[]> {
        const where: any = {};

        if (budgetId) {
            where.budgetId = budgetId;
        }

        if (isRead !== undefined) {
            where.isRead = isRead;
        }

        return await this.prisma.budgetAlert.findMany({
            where,
            include: {
                budget: {
                    include: {
                        category: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async markAlertAsRead(id: string, readBy: string): Promise<BudgetAlert> {
        return await this.prisma.budgetAlert.update({
            where: { id },
            data: {
                isRead: true,
                readAt: new Date(),
                readBy,
            },
        });
    }

    // ============================================
    // CASH FLOW FORECAST
    // ============================================

    async createForecast(data: CreateForecastDTO): Promise<CashFlowForecast> {
        return await this.prisma.cashFlowForecast.create({
            data: {
                ...data,
                projectedRevenue: BigInt(data.projectedRevenue),
                projectedExpenses: BigInt(data.projectedExpenses),
                projectedCashFlow: BigInt(data.projectedCashFlow),
                projectedBalance: BigInt(data.projectedBalance),
            },
        });
    }

    async getForecasts(
        startDate: Date,
        endDate: Date,
        scenarioType?: string
    ): Promise<CashFlowForecast[]> {
        const where: any = {
            forecastDate: {
                gte: startDate,
                lte: endDate,
            },
        };

        if (scenarioType) {
            where.scenarioType = scenarioType;
        }

        return await this.prisma.cashFlowForecast.findMany({
            where,
            orderBy: { forecastDate: 'asc' },
        });
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    private async checkAndCreateAlerts(
        budgetId: string,
        budgetAmount: bigint,
        actualAmount: bigint,
        variancePercent: number
    ): Promise<void> {
        const utilizationPercent = Number((actualAmount * BigInt(100)) / budgetAmount);

        // Alert at 80% utilization
        if (utilizationPercent >= 80 && utilizationPercent < 100) {
            await this.createAlert(
                budgetId,
                'APPROACHING_LIMIT',
                80,
                `Budget telah mencapai ${utilizationPercent.toFixed(1)}% dari limit`
            );
        }

        // Alert at 100% (exceeded)
        if (utilizationPercent >= 100) {
            await this.createAlert(
                budgetId,
                'EXCEEDED',
                100,
                `Budget telah terlampaui sebesar ${utilizationPercent.toFixed(1)}%`
            );
        }

        // Alert for high variance (>20%)
        if (Math.abs(variancePercent) > 20) {
            await this.createAlert(
                budgetId,
                'VARIANCE_HIGH',
                20,
                `Variance tinggi: ${variancePercent > 0 ? '+' : ''}${variancePercent.toFixed(1)}%`
            );
        }
    }
}
