"use client";

import {
  useEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const DEFAULT_PANEL_CLASS =
  "w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl outline-none dark:bg-[#1a2632]";

type Props = {
  /** id judul di dalam dialog, dipakai sebagai nama aksesibelnya. */
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  panelClassName?: string;
};

/**
 * Lembar dialog portal pelanggan. Dirender ke body dengan z-[55]: di atas
 * BottomNav (z-50) agar tombolnya bisa diketuk di HP, tetapi di bawah toast
 * (z-[60]) agar pesan galat tetap terbaca. Escape dan ketukan di luar lembar
 * menutupnya, Tab berputar di dalamnya, dan fokus kembali ke pemicunya.
 */
export function CustomerDialog({
  labelledBy,
  onClose,
  children,
  panelClassName = DEFAULT_PANEL_CLASS,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(panelRef, onClose);

  const closeOnBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const dialog = (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center"
      onClick={closeOnBackdrop}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={panelClassName}
      >
        {children}
      </div>
    </div>
  );

  return typeof document === "undefined"
    ? dialog
    : createPortal(dialog, document.body);
}

function useDialogFocus(
  panelRef: RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    (focusableIn(panel)[0] ?? panel).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === "Tab") {
        keepFocusInside(panel, event);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [panelRef]);
}

function focusableIn(panel: HTMLElement) {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => !element.closest("[hidden]"));
}

function keepFocusInside(panel: HTMLElement, event: KeyboardEvent) {
  const focusable = focusableIn(panel);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (!first || !last) {
    event.preventDefault();
    panel.focus();
    return;
  }
  const isOutside = !panel.contains(active);
  if (event.shiftKey && (active === first || isOutside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || isOutside)) {
    event.preventDefault();
    first.focus();
  }
}
