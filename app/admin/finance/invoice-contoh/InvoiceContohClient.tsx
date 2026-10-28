"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useApi } from "@/lib/hooks/useApi";
import type {
  SampleGenerateInput,
  SampleInvoiceLimits,
  SampleIssuer,
  ZipPart,
} from "@/modules/sample-invoice";
import { BatchHistory } from "./BatchHistory";
import { downloadParts } from "./download-parts";
import { GenerateForm } from "./GenerateForm";
import { LimitsPanel } from "./LimitsPanel";
import { fetchStreets } from "./overpass";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const currentWibMonth = () =>
  new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 7);

type Mitra = { id: string; name: string };

export default function InvoiceContohClient({
  canEditLimits,
  canDelete,
}: {
  canEditLimits: boolean;
  canDelete: boolean;
}) {
  const { showToast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const mitraQuery = useApi<Mitra[]>("/api/admin/sample-invoices/mitras");
  const issuerQuery = useApi<SampleIssuer>("/api/admin/sample-invoices/issuer");
  const limitsQuery = useApi<SampleInvoiceLimits>(
    "/api/admin/sample-invoices/limits",
  );
  const mitras = mitraQuery.data ?? [];

  async function generate(input: SampleGenerateInput) {
    const response = await fetch("/api/admin/sample-invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await response.json();
    if (!response.ok) {
      showToast("error", body.error ?? "Gagal generate invoice contoh");
      return;
    }
    const { batchId, parts } = body.data as {
      batchId: string;
      parts: ZipPart[];
    };
    showToast(
      "success",
      parts.length === 1
        ? "Invoice contoh dibuat; ZIP sedang diunduh"
        : `Invoice contoh dibuat dalam ${parts.length} bagian ZIP`,
    );
    setRefreshKey((key) => key + 1);
    await downloadParts(batchId, parts);
  }

  if (!issuerQuery.data || !limitsQuery.data) {
    return <p className="text-sm text-gray-500">Memuat…</p>;
  }

  return (
    <div className="space-y-6">
      <GenerateForm
        mitras={mitras}
        issuer={issuerQuery.data}
        limits={limitsQuery.data}
        currentMonth={currentWibMonth()}
        fetchStreets={fetchStreets}
        onSubmit={generate}
      />
      {canEditLimits && (
        <LimitsPanel
          limits={limitsQuery.data}
          onSaved={(limits) =>
            limitsQuery.mutate(limits, { revalidate: false })
          }
        />
      )}
      <BatchHistory
        mitras={mitras}
        canDelete={canDelete}
        refreshKey={refreshKey}
      />
    </div>
  );
}
