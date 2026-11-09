"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import SignaturePad, {
  type SignaturePadHandle,
} from "@/components/signature/SignaturePad";
import { todayIsoDate } from "@/lib/utils/purchase-input";

import { BELANJA_TEXTS } from "./belanja-texts";
import { BelanjaItemRow } from "./BelanjaItemRow";
import {
  buildBelanjaSubmitInput,
  buildInitialBelanjaForm,
  findBelanjaFormProblems,
  mergeBelanjaFormLines,
  type BelanjaForm,
  type BelanjaFormLine,
  type BelanjaList,
} from "./belanjaForm";
import {
  readStoredBuyerName,
  storeBuyerName,
  useBelanjaLink,
} from "./useBelanjaLink";

/** Batas panjang isian; sama dengan batas server. */
const NOTES_MAX_LENGTH = 500;
const BUYER_NAME_MAX_LENGTH = 100;

const FIELD_CLASS =
  "min-h-[44px] w-full rounded-xl border border-gray-400 bg-white px-3 py-2 text-base text-gray-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-indigo-900";
const LABEL_CLASS = "block text-sm font-bold text-gray-900 dark:text-white";
const HINT_CLASS = "text-sm text-gray-600 dark:text-gray-400";
const PRIMARY_BUTTON_CLASS =
  "min-h-[48px] w-full rounded-2xl bg-indigo-700 px-4 py-3 text-base font-bold text-white hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 aria-disabled:opacity-60";

function MessagePanel({
  title,
  body,
  tone,
  children,
}: {
  title: string;
  body: string;
  tone: "neutral" | "success";
  children?: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "border-green-200 bg-green-50 dark:border-green-900/60 dark:bg-green-950/30"
      : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800";
  return (
    <section className={`space-y-3 rounded-2xl border p-5 ${toneClass}`}>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
        {title}
      </h2>
      <p className="text-base text-gray-700 dark:text-gray-300">{body}</p>
      {children}
    </section>
  );
}

/** Pesan tersimpan; `id` baru setiap simpan agar teks yang sama tetap muncul. */
interface SavedNotice {
  id: number;
  text: string;
}

function SavedBanner({ notice }: { notice: SavedNotice | null }) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const noticeId = notice?.id ?? null;
  useEffect(() => {
    if (noticeId !== null) bannerRef.current?.focus();
  }, [noticeId]);
  if (!notice) return null;
  return (
    <div
      ref={bannerRef}
      role="status"
      tabIndex={-1}
      className="rounded-2xl border border-green-300 bg-green-50 p-4 text-base font-semibold text-green-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100"
    >
      {notice.text}
    </div>
  );
}

function ProblemList({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <p className="font-bold">{BELANJA_TEXTS.problemsTitle}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Daftar masalah isian dan galat kiriman. Tombol simpan menempel di bawah
 * layar, jadi setiap kali simpan gagal kotak ini digulir ke tengah layar
 * dan difokuskan; tanpa itu pembeli di bagian atas halaman tidak melihat
 * apa pun berubah.
 */
function SubmitFeedback({
  problems,
  submitError,
  focusKey,
}: {
  problems: string[];
  submitError: string | null;
  focusKey: number;
}) {
  const regionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const region = regionRef.current;
    if (focusKey === 0 || !region?.hasChildNodes()) return;
    region.scrollIntoView({ block: "center" });
    region.focus({ preventScroll: true });
  }, [focusKey]);
  return (
    <div
      ref={regionRef}
      tabIndex={-1}
      className="space-y-3 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
    >
      <ProblemList problems={problems} />
      {submitError && (
        <p
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
        >
          {submitError}
        </p>
      )}
    </div>
  );
}

interface BelanjaFormViewProps {
  list: BelanjaList;
  form: BelanjaForm;
  onFormChange: (change: (form: BelanjaForm) => BelanjaForm) => void;
  padRef: React.RefObject<SignaturePadHandle | null>;
  onSignatureChange: (hasStroke: boolean) => void;
  problems: string[];
  submitError: string | null;
  feedbackFocusKey: number;
  isSubmitting: boolean;
  onSubmit: () => void;
}

function BelanjaFormView({
  list,
  form,
  onFormChange,
  padRef,
  onSignatureChange,
  problems,
  submitError,
  feedbackFocusKey,
  isSubmitting,
  onSubmit,
}: BelanjaFormViewProps) {
  const baseId = useId();
  const lineById = new Map(
    form.lines.map((line) => [line.purchaseOrderItemId, line]),
  );
  const updateLine = (
    purchaseOrderItemId: string,
    change: Partial<BelanjaFormLine>,
  ) =>
    onFormChange((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.purchaseOrderItemId === purchaseOrderItemId
          ? { ...line, ...change }
          : line,
      ),
    }));
  const setField = (field: keyof Omit<BelanjaForm, "lines">, value: string) =>
    onFormChange((current) => ({ ...current, [field]: value }));

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <fieldset className="space-y-3">
        <legend className={`${LABEL_CLASS} mb-2`}>
          {BELANJA_TEXTS.itemsLegend}
        </legend>
        <ul className="space-y-3">
          {list.items.map((item) => {
            const line = lineById.get(item.purchaseOrderItemId);
            if (!line) return null;
            return (
              <BelanjaItemRow
                key={item.purchaseOrderItemId}
                item={item}
                line={line}
                onToggle={(isChecked) =>
                  updateLine(item.purchaseOrderItemId, { isChecked })
                }
                onQuantityChange={(quantity) =>
                  updateLine(item.purchaseOrderItemId, { quantity })
                }
                onPriceChange={(unitPrice) =>
                  updateLine(item.purchaseOrderItemId, { unitPrice })
                }
              />
            );
          })}
        </ul>
      </fieldset>

      <div className="space-y-1">
        <label htmlFor={`${baseId}-date`} className={LABEL_CLASS}>
          {BELANJA_TEXTS.dateLabel}
        </label>
        <input
          id={`${baseId}-date`}
          type="date"
          required
          max={todayIsoDate()}
          value={form.purchasedAt}
          onChange={(event) => setField("purchasedAt", event.target.value)}
          className={FIELD_CLASS}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={`${baseId}-notes`} className={LABEL_CLASS}>
          {BELANJA_TEXTS.notesLabel}
        </label>
        <textarea
          id={`${baseId}-notes`}
          rows={2}
          maxLength={NOTES_MAX_LENGTH}
          value={form.notes}
          onChange={(event) => setField("notes", event.target.value)}
          className={FIELD_CLASS}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={`${baseId}-buyer`} className={LABEL_CLASS}>
          {BELANJA_TEXTS.buyerLabel}
        </label>
        <input
          id={`${baseId}-buyer`}
          type="text"
          required
          maxLength={BUYER_NAME_MAX_LENGTH}
          autoComplete="name"
          aria-describedby={`${baseId}-buyer-hint`}
          value={form.buyerName}
          onChange={(event) => setField("buyerName", event.target.value)}
          className={FIELD_CLASS}
        />
        <p id={`${baseId}-buyer-hint`} className={HINT_CLASS}>
          {BELANJA_TEXTS.buyerHint}
        </p>
      </div>

      <div className="space-y-1">
        <p className={LABEL_CLASS}>{BELANJA_TEXTS.signatureLabel}</p>
        <SignaturePad
          ref={padRef}
          label={BELANJA_TEXTS.signatureLabel}
          hint={BELANJA_TEXTS.signatureHint}
          onChange={onSignatureChange}
        />
      </div>

      <SubmitFeedback
        problems={problems}
        submitError={submitError}
        focusKey={feedbackFocusKey}
      />

      <div className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-gray-50/95 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-950/95">
        <button
          type="submit"
          aria-disabled={isSubmitting}
          className={PRIMARY_BUTTON_CLASS}
        >
          {isSubmitting ? BELANJA_TEXTS.submitting : BELANJA_TEXTS.submit}
        </button>
      </div>
    </form>
  );
}

/**
 * Halaman daftar belanja tanpa login: daftar barang yang perlu dibeli dan
 * isian satu kali belanja, lengkap dengan nama dan tanda tangan
 * pembeli.
 */
export default function BelanjaClient() {
  const { status, list, loadError, retry, submit } = useBelanjaLink();
  const padRef = useRef<SignaturePadHandle>(null);
  const [form, setForm] = useState<BelanjaForm | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<SavedNotice | null>(null);
  const [feedbackFocusKey, setFeedbackFocusKey] = useState(0);

  // Daftar baru dari server: susun ulang isian saat render (bukan di effect)
  // supaya tidak ada render berantai.
  const [formSource, setFormSource] = useState<BelanjaList | null>(null);
  if (list && list !== formSource) {
    setFormSource(list);
    setForm((current) =>
      current
        ? mergeBelanjaFormLines(current, list)
        : buildInitialBelanjaForm(list, readStoredBuyerName()),
    );
  }

  // Begitu pembeli mulai mengisi belanja berikutnya, pesan "Tersimpan" yang
  // lama disembunyikan supaya tidak dikira berlaku untuk isian baru.
  const updateForm = useCallback(
    (change: (current: BelanjaForm) => BelanjaForm) => {
      setSavedNotice(null);
      setForm((current) => (current ? change(current) : current));
    },
    [],
  );
  const handleSignatureChange = useCallback((hasStroke: boolean) => {
    setHasSignature(hasStroke);
    if (hasStroke) setSavedNotice(null);
  }, []);
  const showSubmitFeedback = () => setFeedbackFocusKey((key) => key + 1);

  const problems =
    form && list && hasTriedSubmit
      ? findBelanjaFormProblems(form, list.items, hasSignature)
      : [];

  const handleSubmit = async () => {
    if (!form || !list || isSubmitting) return;
    setHasTriedSubmit(true);
    setSubmitError(null);
    const signatureDataUrl = padRef.current?.toDataUrl() ?? null;
    const found = findBelanjaFormProblems(
      form,
      list.items,
      signatureDataUrl !== null,
    );
    if (found.length > 0 || !signatureDataUrl) {
      showSubmitFeedback();
      return;
    }

    setIsSubmitting(true);
    const input = buildBelanjaSubmitInput(form, signatureDataUrl);
    storeBuyerName(input.buyerName);
    const result = await submit(input);
    setIsSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.message);
      showSubmitFeedback();
      return;
    }
    setSavedNotice((previous) => ({
      id: (previous?.id ?? 0) + 1,
      text: [BELANJA_TEXTS.saved(input.buyerName), result.message]
        .filter(Boolean)
        .join(" "),
    }));
    setHasTriedSubmit(false);
    padRef.current?.clear();
    setForm(
      result.list
        ? buildInitialBelanjaForm(result.list, input.buyerName)
        : null,
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-xl space-y-5 px-4 py-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">{BELANJA_TEXTS.title}</h1>
          {list && (
            <p className="text-base text-gray-700 dark:text-gray-300">
              {BELANJA_TEXTS.subtitle(list.requestNumber, list.warehouseName)}
            </p>
          )}
        </header>

        <div aria-live="polite">
          {status === "loading" && (
            <p className={HINT_CLASS}>{BELANJA_TEXTS.loading}</p>
          )}
        </div>

        {status !== "inactive" && <SavedBanner notice={savedNotice} />}

        {status === "inactive" && (
          <MessagePanel
            title={BELANJA_TEXTS.inactiveTitle}
            body={BELANJA_TEXTS.inactiveBody}
            tone="neutral"
          />
        )}

        {status === "error" && (
          <MessagePanel
            title={BELANJA_TEXTS.errorTitle}
            body={loadError ?? BELANJA_TEXTS.serverError}
            tone="neutral"
          >
            <button
              type="button"
              onClick={retry}
              className={PRIMARY_BUTTON_CLASS}
            >
              {BELANJA_TEXTS.retry}
            </button>
          </MessagePanel>
        )}

        {status === "allPurchased" && (
          <MessagePanel
            title={BELANJA_TEXTS.allPurchasedTitle}
            body={BELANJA_TEXTS.allPurchasedBody}
            tone="success"
          />
        )}

        {status === "form" && list && form && (
          <>
            <p className="text-base text-gray-700 dark:text-gray-300">
              {BELANJA_TEXTS.instructions}
            </p>
            <BelanjaFormView
              list={list}
              form={form}
              onFormChange={updateForm}
              padRef={padRef}
              onSignatureChange={handleSignatureChange}
              problems={problems}
              submitError={submitError}
              feedbackFocusKey={feedbackFocusKey}
              isSubmitting={isSubmitting}
              onSubmit={() => void handleSubmit()}
            />
          </>
        )}
      </div>
    </main>
  );
}
