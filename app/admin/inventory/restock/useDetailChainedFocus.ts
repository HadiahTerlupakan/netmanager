"use client";

import { useCallback, useEffect, useRef } from "react";

function getFocusedElement(): HTMLElement | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return null;
  return active;
}

/**
 * Fokus untuk modal yang dibuka dari dalam detail pengajuan. Detail tertutup
 * saat modal berikutnya (catat belanja, terima barang) dibuka, sehingga tombol
 * pemicunya hilang dari halaman. Hook ini mengingat tombol di tabel yang
 * membuka detail, lalu mengembalikan fokus ke sana saat modal berikutnya
 * ditutup.
 *
 * @param isChainedModalOpen true selama modal lanjutan masih terbuka.
 */
export function useDetailChainedFocus(isChainedModalOpen: boolean) {
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const returnTargetRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isChainedModalOpen;
    if (!wasOpen || isChainedModalOpen) return;
    const target = returnTargetRef.current;
    returnTargetRef.current = null;
    if (target?.isConnected) target.focus();
  }, [isChainedModalOpen]);

  /** Ingat tombol yang membuka detail; panggil tepat sebelum detail dibuka. */
  const rememberDetailTrigger = useCallback(() => {
    detailTriggerRef.current = getFocusedElement();
  }, []);

  /** Modal lanjutan dibuka dari detail: fokus nanti kembali ke tombol tabel. */
  const markOpenedFromDetail = useCallback(() => {
    returnTargetRef.current = detailTriggerRef.current;
  }, []);

  return { rememberDetailTrigger, markOpenedFromDetail };
}
