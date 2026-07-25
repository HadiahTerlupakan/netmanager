import type { RABProject } from "./rabTypes";

export interface ExpenseFormItem {
  id?: string;
  amount: string;
  description: string;
  rabProjectId: string;
  rabItemId: string;
  category?: string;
  expenseCategoryId: string;
  isUsefulLifeEnabled: boolean;
  usefulLife: number;
  depreciation: string;
}

export interface ExpenseItem {
  id: string;
  date: string;
  amount: string;
  category: string;
  expenseCategoryId?: string;
  expenseCategory?: {
    id: string;
    name: string;
    type: string;
  };
  categoryId?: string;
  transactionCategory?: {
    id: string;
    name: string;
  };
  accountId?: string;
  financialAccount?: {
    id: string;
    name: string;
    balance: number;
  };
  depreciation?: string;
  usefulLife?: number;
  description?: string;
  siteId?: string;
  mixRadiusGroupId?: string;
  invoiceNumber?: string;
  invoiceFile?: string;
  site?: {
    id: string;
    name: string;
  };
  mixRadiusGroup?: {
    id: string;
    name: string;
  };
  user?: {
    name: string;
  };
  rabProject?: {
    id: string;
    name: string;
  };
  rabItem?: {
    id: string;
    name: string;
  };
}

export interface SiteOption {
  id: string;
  name: string;
  siteId?: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  _count?: { children: number };
}

export interface InvestorSiteOption {
  id: string;
  name: string;
}

export interface RabBottleneckMetrics {
  pendingApprovalCount: number;
  oldestPendingDays: number;
  oldestPendingProjectName: string | null;
  averageApprovalLeadHours: number;
}

export interface ExpensesFormState {
  date: string;
  category: string;
  siteId: string;
  mixRadiusGroupId: string;
  invoiceNumber: string;
  invoiceFile: string;
}

export interface ExpensesDailySectionProps {
  allFilteredSelected: boolean;
  canDelete: boolean;
  canUpdate: boolean;
  categories: CategoryOption[];
  currentPage: number;
  data: ExpenseItem[];
  endDate: string;
  filterCategories: CategoryOption[];
  filteredData: ExpenseItem[];
  formData: ExpensesFormState;
  formTotal: number;
  isDailySimpleMode: boolean;
  isModalOpen: boolean;
  isSubmitting: boolean;
  isUploadingInvoice: boolean;
  items: ExpenseFormItem[];
  itemsPerPage: number | "all";
  loading: boolean;
  opexCategoryOptions: Array<{
    value: string;
    label: React.ReactNode;
    searchLabel: string;
  }>;
  capexCategoryOptions: Array<{
    value: string;
    label: React.ReactNode;
    searchLabel: string;
  }>;
  paginatedData: ExpenseItem[];
  rabProjects: RABProject[];
  search: string;
  selectedCategory: string;
  selectedExpenseIds: string[];
  selectedSite: string;
  selectedSubCategory: string;
  selectedFilteredCount: number;
  sites: SiteOption[];
  startDate: string;
  step: number;
  totalAmount: number;
  totalCapex: number;
  totalOpex: number;
  totalPages: number;
  dailyIndicators: {
    suspectedDuplicateCount: number;
    pendingVerificationCount: number;
  };
  onAddItem: () => void;
  onCloseModal: () => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onHandleSubmit: (event: React.SubmitEvent) => void;
  onInvoiceUpload: (file: File) => void;
  onItemsPerPageChange: (value: number | "all") => void;
  onNextStep: () => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (item: ExpenseItem) => void;
  onPageChange: (page: number) => void;
  onPrevStep: () => void;
  onRemoveItem: (index: number) => void;
  onSearchChange: (value: string) => void;
  onSelectAllFiltered: () => void;
  onSelectedCategoryChange: (value: string) => void;
  onSelectedSiteChange: (value: string) => void;
  onSelectedSubCategoryChange: (value: string) => void;
  onSetDailySimpleMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  onSetFormData: React.Dispatch<React.SetStateAction<ExpensesFormState>>;
  onSetStep: (step: number) => void;
  onSetStartDate: (value: string) => void;
  onSetEndDate: (value: string) => void;
  onToggleExpenseSelection: (id: string) => void;
  onUpdateItem: (
    index: number,
    field: keyof ExpenseFormItem,
    value: string,
  ) => void;
}
