"use client";

import { usePermission } from "@/hooks/use-permission";
import { MitraDeleteModal } from "./components/MitraDeleteModal";
import { MitraFormModal } from "./components/MitraFormModal";
import { MitraFilters, MitraPageHeader } from "./components/MitraPageControls";
import { MitraStatsCards } from "./components/MitraStatsCards";
import { MitraTablePanel } from "./components/MitraTablePanel";
import { MitraWalletModal } from "./components/MitraWalletModal";
import {
  mitraColumns,
  renderMitraActions,
} from "./components/mitraTableColumns";
import {
  initialFormState,
  mitraToFormState,
} from "./components/mitraFormPayload";
import { useMitraDeleteAction } from "./hooks/useMitraDeleteAction";
import { useMitraFormActions } from "./hooks/useMitraFormActions";
import { useMitraList } from "./hooks/useMitraList";
import { useMitraWalletActions } from "./hooks/useMitraWalletActions";

export default function MitraListClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("mitra:create");
  const canUpdate = hasPermission("mitra:update");
  const canDelete = hasPermission("mitra:delete");

  const list = useMitraList();
  const formActions = useMitraFormActions(list.fetchMitras);
  const deleteAction = useMitraDeleteAction(list.fetchMitras);
  const walletActions = useMitraWalletActions(list.fetchMitras);

  return (
    <div className="space-y-6">
      <MitraPageHeader canCreate={canCreate} onAdd={formActions.openAddModal} />
      <MitraStatsCards stats={list.stats} />
      <MitraFilters
        searchTerm={list.searchTerm}
        onSearchTermChange={(value) => {
          list.setSearchTerm(value);
          list.setPage(1);
        }}
        typeFilter={list.typeFilter}
        onTypeFilterChange={(value) => {
          list.setTypeFilter(value);
          list.setPage(1);
        }}
      />
      <MitraTablePanel
        loading={list.loading}
        mitras={list.mitras}
        columns={mitraColumns}
        renderActions={(mitra) =>
          renderMitraActions(mitra, {
            onEdit: formActions.openEditModal,
            onWallet: walletActions.openWalletModal,
            onDelete: deleteAction.setDeleteId,
            onRequestFaceVerification: list.handleRequestFaceVerification,
            canUpdate,
            canDelete,
          })
        }
        searchTerm={list.searchTerm}
        typeFilter={list.typeFilter}
        page={list.page}
        totalPages={list.totalPages}
        total={list.total}
        setPage={list.setPage}
      />
      <MitraFormModal
        isOpen={formActions.showAddModal}
        onClose={() => formActions.setShowAddModal(false)}
        title="Tambah Mitra Baru"
        submitLabel="Simpan"
        submittingLabel="Menyimpan..."
        saving={formActions.saving}
        onSubmit={formActions.handleAdd}
        defaultValues={initialFormState}
        sites={list.sites}
        mixradiusOwners={list.mixradiusOwners}
        ownerSearchTerm={list.ownerSearchTerm}
        setOwnerSearchTerm={list.setOwnerSearchTerm}
        onFileUpload={formActions.handleFileUpload}
        isEdit={false}
      />
      <MitraFormModal
        isOpen={formActions.showEditModal}
        onClose={() => formActions.setShowEditModal(false)}
        title="Edit Mitra"
        submitLabel="Simpan Perubahan"
        submittingLabel="Menyimpan..."
        saving={formActions.saving}
        onSubmit={formActions.handleEdit}
        defaultValues={
          formActions.selectedMitra
            ? mitraToFormState(formActions.selectedMitra)
            : initialFormState
        }
        sites={list.sites}
        mixradiusOwners={list.mixradiusOwners}
        ownerSearchTerm={list.ownerSearchTerm}
        setOwnerSearchTerm={list.setOwnerSearchTerm}
        onFileUpload={formActions.handleFileUpload}
        isEdit={true}
      />
      <MitraWalletModal
        isOpen={walletActions.showWalletModal}
        onClose={() => walletActions.setShowWalletModal(false)}
        selectedMitra={walletActions.selectedWalletMitra}
        walletData={walletActions.walletData}
        canUpdate={canUpdate}
        adjusting={walletActions.adjusting}
        adjustmentForm={walletActions.adjustmentForm}
        setAdjustmentForm={walletActions.setAdjustmentForm}
        onAdjustment={walletActions.handleAdjustment}
      />
      <MitraDeleteModal
        isOpen={!!deleteAction.deleteId}
        onClose={() => deleteAction.setDeleteId(null)}
        deleting={deleteAction.deleting}
        onDelete={deleteAction.handleDelete}
      />
    </div>
  );
}
