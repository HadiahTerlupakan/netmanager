import { Budget, BudgetCategory, BudgetAlert, CashFlowForecast } from '@prisma/client';

// Budget DTOs
export interface CreateBudgetDTO {
    year: number;
    month: number;
    categoryId: string;
    department?: string;
    budgetAmount: bigint;
    notes?: string;
    createdBy?: string;
}

export interface UpdateBudgetDTO {
    budgetAmount?: bigint;
    actualAmount?: bigint;
    department?: string;
    status?: string;
    notes?: string;
    updatedBy?: string;
}

export interface BudgetFilter {
    year?: number;
    month?: number;
    categoryId?: string;
    department?: string;
    status?: string;
    type?: string; // OPE X or CAPEX
}

export interface BudgetWithCategory extends Budget {
    category: BudgetCategory;
    alerts: BudgetAlert[];
}

// Budget Analysis DTOs
export interface BudgetAnalysis {
    year: number;
    month: number;
    budgetsByCategory: {
        category: BudgetCategory;
        budget: Budget;
        utilizationPercent: number;
        status: 'under' | 'ok' | 'warning' | 'exceeded';
    }[];
    totalBudget: bigint;
    totalActual: bigint;
    totalVariance: bigint;
    overallUtilizationPercent: number;
}

// Budget Category DTOs
export interface CreateBudgetCategoryDTO {
    code: string;
    name: string;
    type: string;
    parentId?: string;
    description?: string;
}

// Cash Flow Forecast DTOs
export interface CreateForecastDTO {
    forecastDate: Date;
    scenarioType: string;
    projectedRevenue: bigint;
    projectedExpenses: bigint;
    projectedCashFlow: bigint;
    projectedBalance: bigint;
    confidence?: number;
    assumptions?: string;
    notes?: string;
    createdBy?: string;
}

// Repository Interface
export interface IBudgetRepository {
    // Budget CRUD
    createBudget(data: CreateBudgetDTO): Promise<Budget>;
    getBudgets(filter: BudgetFilter, page?: number, limit?: number): Promise<{
        data: BudgetWithCategory[];
        total: number;
        page: number;
        limit: number;
    }>;
    getBudgetById(id: string): Promise<BudgetWithCategory | null>;
    updateBudget(id: string, data: UpdateBudgetDTO): Promise<Budget>;
    deleteBudget(id: string): Promise<void>;
    approveBudget(id: string, approvedBy: string): Promise<Budget>;

    // Budget Analysis
    getBudgetAnalysis(month: number, year: number): Promise<BudgetAnalysis>;
    updateActualAmount(budgetId: string, amount: bigint): Promise<Budget>;

    // Budget Categories
    createCategory(data: CreateBudgetCategoryDTO): Promise<BudgetCategory>;
    getCategories(type?: string, includeInactive?: boolean): Promise<BudgetCategory[]>;
    getCategoryById(id: string): Promise<BudgetCategory | null>;

    // Budget Alerts
    createAlert(budgetId: string, alertType: string, threshold: number, message: string): Promise<BudgetAlert>;
    getAlerts(budgetId?: string, isRead?: boolean): Promise<BudgetAlert[]>;
    markAlertAsRead(id: string, readBy: string): Promise<BudgetAlert>;

    // Cash Flow Forecast
    createForecast(data: CreateForecastDTO): Promise<CashFlowForecast>;
    getForecasts(startDate: Date, endDate: Date, scenarioType?: string): Promise<CashFlowForecast[]>;
}
