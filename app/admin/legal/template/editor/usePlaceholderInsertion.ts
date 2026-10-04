"use client";

import { useCallback, useRef, useState } from "react";
import { insertAtSelection, placeholderToken } from "./template-blocks";

/**
 * Mengingat kotak teks blok yang terakhir difokus, lalu menyisipkan `{{kunci}}`
 * di posisi kursornya. Nilai baru diteruskan lewat `apply` milik kotak itu
 * sehingga state tetap satu sumber (bukan menulis langsung ke DOM).
 */

export type TextFieldElement = HTMLInputElement | HTMLTextAreaElement;
export type ApplyFieldText = (nextValue: string) => void;
export type TrackFieldFocus = (element: TextFieldElement, apply: ApplyFieldText) => void;

interface FocusTarget {
  element: TextFieldElement;
  apply: ApplyFieldText;
}

/** Status & aksi penyisipan isian untuk satu editor blok. */
export function usePlaceholderInsertion() {
  const targetRef = useRef<FocusTarget | null>(null);
  const [hasTarget, setHasTarget] = useState(false);

  /** Catat kotak teks yang baru difokus beserta cara memperbarui nilainya. */
  const trackFocus = useCallback<TrackFieldFocus>((element, apply) => {
    targetRef.current = { element, apply };
    setHasTarget(true);
  }, []);

  /** Lupakan target, mis. setelah blok dipindah/dihapus (indeksnya berubah). */
  const clearTarget = useCallback(() => {
    targetRef.current = null;
    setHasTarget(false);
  }, []);

  /** Sisipkan isian di kursor kotak teks terakhir; false bila belum ada target. */
  const insertPlaceholder = useCallback((key: string): boolean => {
    const target = targetRef.current;
    if (!target || !target.element.isConnected) return false;

    const { element, apply } = target;
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    const insertion = insertAtSelection(element.value, placeholderToken(key), start, end);
    apply(insertion.value);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(insertion.cursor, insertion.cursor);
    });
    return true;
  }, []);

  return { hasTarget, trackFocus, clearTarget, insertPlaceholder };
}
