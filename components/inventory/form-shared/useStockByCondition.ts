"use client";

import { useEffect, useState } from "react";

import { clientLogger } from "@/lib/client-logger";

import type { BarangOption } from "./useBarangOptions";

export interface StockByCondition {
  BARU: number;
  BEKAS: number;
  RUSAK: number;
  totalStok: number;
}

const ZERO_STOCK: StockByCondition = {
  BARU: 0,
  BEKAS: 0,
  RUSAK: 0,
  totalStok: 0,
};

interface UseStockByConditionArgs {
  barangId: string;
  gudangId: string;
  /** Source endpoint: "keluar" untuk POV barang keluar, "transfer" untuk transfer. */
  endpoint: "keluar" | "transfer";
  /** Fallback barang option untuk hitung total stok kalau API endpoint tidak return per-kondisi. */
  fallbackBarang?: BarangOption;
}

/**
 * Fetch stock per kondisi (BARU/BEKAS/RUSAK) untuk kombinasi barang+gudang.
 *
 * - "keluar" → /api/inventory/keluar?checkStock=true
 * - "transfer" → /api/inventory/barang/stock/by-kondisi
 *
 * Fallback ke total stok dari `fallbackBarang.stockPerGudang` kalau API gagal
 * atau tidak return per-kondisi.
 */
export function useStockByCondition({
  barangId,
  gudangId,
  endpoint,
  fallbackBarang,
}: UseStockByConditionArgs) {
  const [stock, setStock] = useState<StockByCondition>(ZERO_STOCK);

  useEffect(() => {
    if (!barangId || !gudangId) return;

    let cancelled = false;

    const url =
      endpoint === "keluar"
        ? `/api/inventory/keluar?checkStock=true&barangId=${barangId}&gudangId=${gudangId}`
        : `/api/inventory/barang/stock/by-kondisi?barangId=${barangId}&gudangId=${gudangId}`;

    const run = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const result = data.data || data;
        if (cancelled) return;
        // Endpoint "keluar" mengembalikan { stokByKondisi: {BARU,BEKAS,RUSAK,total} }
        // Endpoint "transfer" (by-kondisi) mengembalikan { stockPerKondisi: {BARU,BEKAS,RUSAK}, totalStock }
        if (result.stokByKondisi) {
          setStock({
            BARU: result.stokByKondisi.BARU || 0,
            BEKAS: result.stokByKondisi.BEKAS || 0,
            RUSAK: result.stokByKondisi.RUSAK || 0,
            totalStok: result.stokByKondisi.total || 0,
          });
          return;
        }
        if (result.stockPerKondisi) {
          setStock({
            BARU: result.stockPerKondisi.BARU || 0,
            BEKAS: result.stockPerKondisi.BEKAS || 0,
            RUSAK: result.stockPerKondisi.RUSAK || 0,
            totalStok: result.totalStock || 0,
          });
          return;
        }
        setStock(buildFallbackStock(fallbackBarang, gudangId));
      } catch (err) {
        if (cancelled) return;
        clientLogger.error("Error fetching stock by condition:", err);
        setStock(buildFallbackStock(fallbackBarang, gudangId));
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [barangId, gudangId, endpoint, fallbackBarang]);

  // Reset ke nol via derived value ketika tidak ada barang/gudang dipilih,
  // bukan via setState di effect (menghindari rules-of-hooks violation).
  const effectiveStock = barangId && gudangId ? stock : ZERO_STOCK;

  return effectiveStock;
}

function buildFallbackStock(
  barang: BarangOption | undefined,
  gudangId: string,
): StockByCondition {
  if (!barang) return ZERO_STOCK;
  const stockInfo = barang.stockPerGudang?.find((s) => s.gudangId === gudangId);
  return {
    ...ZERO_STOCK,
    totalStok: stockInfo?.stok || 0,
  };
}
