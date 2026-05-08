"use client";

import PageLoader from "@/components/ui/PageLoader";
import CanvasingAccessDenied from "./CanvasingAccessDenied";
import CanvasingListContent from "./CanvasingListContent";
import { useCanvasingPageState } from "./useCanvasingPageState";

/** Render canvasing page shell with loading and access guards. */
export default function CanvasingList() {
  const viewModel = useCanvasingPageState();

  // Show loader while permissions or initial data is loading
  if (viewModel.permissionLoading) {
    return <PageLoader />;
  }

  if (viewModel.loading && viewModel.items.length === 0) {
    return <PageLoader />;
  }

  // Only check access after permissions are loaded
  if (!viewModel.permissions.canRead) return <CanvasingAccessDenied />;

  return <CanvasingListContent viewModel={viewModel} />;
}
