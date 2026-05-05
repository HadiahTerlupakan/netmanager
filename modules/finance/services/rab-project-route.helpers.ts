import { RabExpenseType } from "../types/invoice.enums";
import { createRouteServiceError } from "./RouteServiceError";

const APPROVAL_ONLY_STATUSES = new Set(["APPROVED", "REJECTED"]);

type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
};

type ProjectApprovalSummary = {
  status: string;
  createdAt: Date;
};

type ApprovedProjectMetric = {
  rabProjectId: string;
  createdAt: Date;
  rabProject: ProjectSummary;
};

type ProjectWithUnknownApprovals = ProjectSummary & {
  approvals?: unknown[] | null;
};

type ActualExpense = {
  amount: bigint;
  category: string;
  rabItemId?: string | null;
  rabItem?: { expenseType?: RabExpenseType | null } | null;
};

/** Memastikan status tidak memakai jalur approval khusus. */
export function assertMutableRabProjectStatus(status: string | undefined) {
  if (status !== undefined && APPROVAL_ONLY_STATUSES.has(status)) {
    throw createRouteServiceError(
      "Status approval RAB wajib diproses melalui endpoint approval.",
      400,
    );
  }
}

/** Memastikan proyek tersedia atau lempar 404. */
export function assertRabProjectExists<T>(project: T | null, label: string): T {
  if (!project) {
    throw createRouteServiceError(label, 404);
  }

  return project;
}

/** Memastikan hanya proyek draft yang boleh dihapus. */
export function assertDraftRabProjectStatus(status: string) {
  if (status !== "DRAFT") {
    throw createRouteServiceError(
      "Hanya proyek RAB dengan status DRAFT yang dapat dihapus",
      400,
    );
  }
}

/** Membuat ringkasan proyek singkat untuk metrik dashboard. */
export function pickRabProjectSummary(project: ProjectSummary): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    createdAt: project.createdAt,
  };
}

/** Mengambil approval proyek approved untuk dashboard bottleneck. */
export function buildApprovedProjectApprovals(
  projects: ProjectWithUnknownApprovals[],
) {
  return projects
    .filter((project) => project.status === "APPROVED")
    .flatMap((project): ApprovedProjectMetric[] =>
      getApprovedProjectApprovals(project.approvals).map((approval) => ({
        rabProjectId: project.id,
        createdAt: approval.createdAt,
        rabProject: pickRabProjectSummary(project),
      })),
    )
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 200);
}

function getApprovedProjectApprovals(approvals: unknown[] | null | undefined) {
  return (approvals ?? [])
    .filter(isProjectApprovalSummary)
    .filter((approval) => approval.status === "APPROVED");
}

function isProjectApprovalSummary(
  value: unknown,
): value is ProjectApprovalSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const approval = value as Partial<ProjectApprovalSummary>;
  return (
    typeof approval.status === "string" && approval.createdAt instanceof Date
  );
}

/** Menggabungkan proyek pending dan approved menjadi daftar unik. */
export function buildUniqueMetricProjects(
  pendingProjects: ProjectSummary[],
  approvedApprovals: ApprovedProjectMetric[],
) {
  const projectsMap = new Map<string, ProjectSummary>();

  pendingProjects.forEach((project) => projectsMap.set(project.id, project));
  approvedApprovals.forEach((approval) => {
    projectsMap.set(approval.rabProject.id, approval.rabProject);
  });

  return Array.from(projectsMap.values());
}

/** Menghitung total CAPEX awal dari item non-OPEX. */
export function calculateOriginalRabCapex(
  items: Array<{ expenseType: RabExpenseType; totalPrice: bigint }>,
) {
  return items.reduce((sum, item) => {
    if (item.expenseType === RabExpenseType.OPEX) {
      return sum;
    }

    return sum + item.totalPrice;
  }, 0n);
}

/** Menghitung realisasi CAPEX, OPEX, dan nilai tanpa mapping item. */
export function calculateActualRabTotals(expenses: ActualExpense[]) {
  return expenses.reduce(
    (acc, expense) => {
      const isOpex = isOpexExpense(expense);
      return {
        actualCapex: acc.actualCapex + (isOpex ? 0n : expense.amount),
        actualOpex: acc.actualOpex + (isOpex ? expense.amount : 0n),
        unmappedRealization:
          acc.unmappedRealization + (expense.rabItemId ? 0n : expense.amount),
      };
    },
    { actualCapex: 0n, actualOpex: 0n, unmappedRealization: 0n },
  );
}

function isOpexExpense(expense: ActualExpense) {
  const expenseType = expense.rabItem?.expenseType ?? expense.category;
  return (
    expenseType === RabExpenseType.OPEX ||
    expense.category === RabExpenseType.OPEX
  );
}
