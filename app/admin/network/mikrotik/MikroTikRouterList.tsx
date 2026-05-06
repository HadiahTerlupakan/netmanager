"use client";

import ReconfigureModal from "@/components/mikrotik/ReconfigureModal";
import TestConnectionModal from "@/components/mikrotik/TestConnectionModal";
import { MikrotikRouterTable } from "@/app/admin/network/mikrotik/components/mikrotikRouterTable";
import { useMikrotikRouterList } from "@/app/admin/network/mikrotik/hooks/useMikrotikRouterList";
import { useMikrotikActions } from "@/app/admin/network/mikrotik/hooks/useMikrotikActions";
import { useMikrotikModals } from "@/app/admin/network/mikrotik/hooks/useMikrotikModals";

/**
 * Main component untuk list MikroTik routers dengan pagination, search, dan actions
 */
export default function MikroTikRouterList() {
  const {
    data,
    loading,
    search,
    setSearch,
    page,
    setPage,
    limit,
    setLimit,
    pppConnectionMode,
    refresh,
  } = useMikrotikRouterList();

  const { deleteRouter, testConnection, isTesting, testResult } =
    useMikrotikActions();

  const { testModal, reconfigureModal } = useMikrotikModals();

  const handleDelete = async (id: string, name: string) => {
    await deleteRouter(id, name, refresh);
  };

  const handleTestConnection = async (id: string) => {
    testModal.open();
    await testConnection(id);
    await refresh();
  };

  return (
    <div className="space-y-5">
      <MikrotikRouterTable
        routers={data.routers}
        total={data.total}
        totalPages={data.totalPages}
        page={page}
        limit={limit}
        loading={loading}
        search={search}
        pppConnectionMode={pppConnectionMode}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
        onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
        onNextPage={() =>
          setPage((prev) => Math.min(data.totalPages, prev + 1))
        }
        onOpenReconfigure={reconfigureModal.open}
        onTestConnection={(id) => {
          void handleTestConnection(id);
        }}
        onDelete={(id, name) => {
          void handleDelete(id, name);
        }}
      />

      <TestConnectionModal
        open={testModal.isOpen}
        onClose={testModal.close}
        result={testResult}
        isLoading={isTesting}
      />

      <ReconfigureModal
        open={reconfigureModal.isOpen}
        onClose={reconfigureModal.close}
        onSuccess={() => {
          reconfigureModal.close();
          void refresh();
        }}
      />
    </div>
  );
}
