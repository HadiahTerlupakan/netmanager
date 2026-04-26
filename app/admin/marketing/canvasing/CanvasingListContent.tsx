import CanvasingListHeader from "./CanvasingListHeader";
import CanvasingListModals from "./CanvasingListModals";
import CanvasingStatusFilters from "./CanvasingStatusFilters";
import CanvasingSummaryCards from "./CanvasingSummaryCards";
import CanvasingTable from "./CanvasingTable";
import type { UseCanvasingPageStateResult } from "./useCanvasingPageState";

interface CanvasingListContentProps {
  viewModel: UseCanvasingPageStateResult;
}

function CanvasingListMainContent({ viewModel }: CanvasingListContentProps) {
  return (
    <>
      <CanvasingListHeader
        canCreate={viewModel.permissions.canCreate}
        search={viewModel.search}
        onSearchChange={viewModel.handleSearchChange}
        onSiteChange={viewModel.updateSiteId}
      />
      <CanvasingSummaryCards summary={viewModel.summary} />
      <CanvasingStatusFilters
        summary={viewModel.summary}
        statusFilter={viewModel.statusFilter}
        onChange={viewModel.updateStatusFilter}
      />
      <CanvasingTable
        items={viewModel.items}
        loading={viewModel.loading}
        page={viewModel.page}
        totalPages={viewModel.totalPages}
        canUpdate={viewModel.permissions.canUpdate}
        canReview={viewModel.permissions.canReview}
        canDelete={viewModel.permissions.canDelete}
        onPageChange={viewModel.setPage}
        onDelete={viewModel.handleDelete}
        onCancelApproval={viewModel.handleCancelApproval}
        onReviewClaim={viewModel.openClaimModal}
      />
    </>
  );
}

function CanvasingListOverlayContent({ viewModel }: CanvasingListContentProps) {
  return (
    <CanvasingListModals
      claimModal={viewModel.claimModal}
      confirmationModal={viewModel.confirmationModal}
      zoomImage={viewModel.zoomImage}
      onApproveClaim={viewModel.handleApproveClaim}
      onRejectClaim={viewModel.handleRejectClaim}
      onCloseClaimModal={viewModel.closeClaimModal}
      onConfirmRowAction={viewModel.confirmRowAction}
      onCloseConfirmationModal={viewModel.closeConfirmationModal}
      onZoomImage={viewModel.openZoomImage}
      onCloseZoomImage={viewModel.closeZoomImage}
    />
  );
}

/** Render canvasing page content from a precomputed page view model. */
export default function CanvasingListContent({
  viewModel,
}: CanvasingListContentProps) {
  return (
    <div className="space-y-6">
      <CanvasingListMainContent viewModel={viewModel} />
      <CanvasingListOverlayContent viewModel={viewModel} />
    </div>
  );
}
