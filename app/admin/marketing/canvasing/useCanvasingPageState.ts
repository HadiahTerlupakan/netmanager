import { useCallback, useMemo } from "react";
import type { ChangeEvent } from "react";
import { usePermission } from "@/hooks/use-permission";
import { useCanvasingClaimReview } from "./useCanvasingClaimReview";
import type { CanvasingStatusFilter } from "./CanvasingListTypes";
import { useCanvasingListQuery } from "./useCanvasingListQuery";
import { useCanvasingRowActions } from "./useCanvasingRowActions";

type CanvasingListQueryState = ReturnType<typeof useCanvasingListQuery>;
type CanvasingClaimReviewState = ReturnType<typeof useCanvasingClaimReview>;
type CanvasingRowActionsState = ReturnType<typeof useCanvasingRowActions>;

interface CanvasingPermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canReview: boolean;
  canDelete: boolean;
}

export interface UseCanvasingPageStateResult {
  items: CanvasingListQueryState["items"];
  loading: boolean;
  permissionLoading: boolean;
  search: string;
  statusFilter: CanvasingStatusFilter;
  page: number;
  totalPages: number;
  summary: CanvasingListQueryState["summary"];
  permissions: CanvasingPermissions;
  setPage: (page: number) => void;
  updateStatusFilter: (value: CanvasingStatusFilter) => void;
  updateSiteId: (value?: string) => void;
  handleSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleDelete: (id: string, name: string) => void;
  handleCancelApproval: (id: string, name: string) => void;
  confirmationModal: CanvasingRowActionsState["confirmationModal"];
  confirmRowAction: CanvasingRowActionsState["confirmRowAction"];
  closeConfirmationModal: CanvasingRowActionsState["closeConfirmationModal"];
  openClaimModal: CanvasingClaimReviewState["openClaimModal"];
  claimModal: CanvasingClaimReviewState["claimModal"];
  zoomImage: CanvasingClaimReviewState["zoomImage"];
  handleApproveClaim: CanvasingClaimReviewState["handleApproveClaim"];
  handleRejectClaim: CanvasingClaimReviewState["handleRejectClaim"];
  closeClaimModal: CanvasingClaimReviewState["closeClaimModal"];
  openZoomImage: CanvasingClaimReviewState["openZoomImage"];
  closeZoomImage: CanvasingClaimReviewState["closeZoomImage"];
}

function useCanvasingPermissions() {
  const {
    hasPermission,
    isLoading: permissionLoading,
    isSuperAdmin,
  } = usePermission();

  const permissions = useMemo<CanvasingPermissions>(
    () => ({
      canRead:
        isSuperAdmin ||
        hasPermission("canvasing:read") ||
        hasPermission("canvasing:verify"),
      canCreate: isSuperAdmin || hasPermission("canvasing:create"),
      canUpdate: isSuperAdmin || hasPermission("canvasing:update"),
      canReview:
        isSuperAdmin ||
        hasPermission("canvasing:update") ||
        hasPermission("canvasing:verify"),
      canDelete: isSuperAdmin || hasPermission("canvasing:delete"),
    }),
    [hasPermission, isSuperAdmin],
  );

  return { permissions, permissionLoading };
}

/** Compose canvasing page state, permissions, and actions into one view model. */
export function useCanvasingPageState(): UseCanvasingPageStateResult {
  const queryState = useCanvasingListQuery();
  const { permissions, permissionLoading } = useCanvasingPermissions();
  const rowActions = useCanvasingRowActions({ refetch: queryState.refetch });
  const claimReview = useCanvasingClaimReview({ refetch: queryState.refetch });

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      queryState.updateSearch(event.target.value);
    },
    [queryState],
  );

  return {
    items: queryState.items,
    loading: queryState.loading,
    permissionLoading,
    search: queryState.search,
    statusFilter: queryState.statusFilter,
    page: queryState.page,
    totalPages: queryState.totalPages,
    summary: queryState.summary,
    permissions,
    setPage: queryState.setPage,
    updateStatusFilter: queryState.updateStatusFilter,
    updateSiteId: queryState.updateSiteId,
    handleSearchChange,
    handleDelete: rowActions.handleDelete,
    handleCancelApproval: rowActions.handleCancelApproval,
    confirmationModal: rowActions.confirmationModal,
    confirmRowAction: rowActions.confirmRowAction,
    closeConfirmationModal: rowActions.closeConfirmationModal,
    openClaimModal: claimReview.openClaimModal,
    claimModal: claimReview.claimModal,
    zoomImage: claimReview.zoomImage,
    handleApproveClaim: claimReview.handleApproveClaim,
    handleRejectClaim: claimReview.handleRejectClaim,
    closeClaimModal: claimReview.closeClaimModal,
    openZoomImage: claimReview.openZoomImage,
    closeZoomImage: claimReview.closeZoomImage,
  };
}
