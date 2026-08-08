import type { PlanningStatus } from "../domain/entities/PlanningEntity";

/**
 * PlanningKanbanCardDTO - Simplified planning card for kanban view
 */
export interface PlanningKanbanCardDTO {
  id: string;
  title: string;
  area: string;
  estimatedBudget: number | null;
  progressPercentage: number;
  targetCompletionDate: string | null;
  itemsCount: number;
  milestonesCount: number;
  completedMilestonesCount: number;
}

/**
 * PlanningKanbanColumnDTO - Single kanban column with cards
 */
export interface PlanningKanbanColumnDTO {
  status: PlanningStatus;
  label: string;
  count: number;
  cards: PlanningKanbanCardDTO[];
}

/**
 * PlanningKanbanBoardDTO - Complete kanban board structure
 */
export interface PlanningKanbanBoardDTO {
  columns: PlanningKanbanColumnDTO[];
  totalCards: number;
}
