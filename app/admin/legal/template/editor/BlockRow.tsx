"use client";

import { useId } from "react";
import { HiOutlineArrowDown, HiOutlineArrowUp, HiOutlineTrash } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS } from "../../components/form/form-fields";
import type { TemplateBlock } from "../../components/legal-types";
import {
  BLOCK_TYPE_LABEL,
  listItemsToText,
  MAX_BLOCK_TEXT_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_LIST_ITEMS,
  setBlockText,
  setListText,
  setSignatureText,
} from "./template-blocks";
import type { TextFieldElement, TrackFieldFocus } from "./usePlaceholderInsertion";

/** Satu blok template: kepala (tipe, naik/turun, hapus) dan kotak teks sesuai tipenya. */

const BODY_TEXT_ROWS = 4;
const MIN_LIST_ROWS = 3;

export type BlockUpdater = (block: TemplateBlock) => TemplateBlock;

export interface BlockRowControls {
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (updater: BlockUpdater) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
  onTrackFocus: TrackFieldFocus;
}

export default function BlockRow({
  block,
  position,
  controls,
}: {
  block: TemplateBlock;
  /** Nomor urut tampilan (mulai 1). */
  position: number;
  controls: BlockRowControls;
}) {
  return (
    <li className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-1.5 dark:border-gray-700/60">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {position}. {BLOCK_TYPE_LABEL[block.type]}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => controls.onMove(-1)}
            disabled={controls.isFirst}
            aria-label={`Naikkan blok ${position}`}
          >
            <HiOutlineArrowUp />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => controls.onMove(1)}
            disabled={controls.isLast}
            aria-label={`Turunkan blok ${position}`}
          >
            <HiOutlineArrowDown />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={controls.onRemove}
            aria-label={`Hapus blok ${position}`}
          >
            <HiOutlineTrash />
          </Button>
        </div>
      </div>
      <div className="space-y-2 p-3">
        <BlockFields block={block} controls={controls} />
      </div>
    </li>
  );
}

/** Kotak teks per tipe blok; tiap perubahan lewat updater agar tidak memakai nilai basi. */
function BlockFields({
  block,
  controls,
}: {
  block: TemplateBlock;
  controls: BlockRowControls;
}) {
  const field = (update: (value: string) => BlockUpdater) => ({
    onValueChange: (value: string) => controls.onUpdate(update(value)),
    onTrackFocus: controls.onTrackFocus,
  });

  switch (block.type) {
    case "heading":
      return (
        <BlockTextInput
          label="Teks judul"
          value={block.text}
          maxLength={MAX_LABEL_LENGTH}
          {...field((value) => (current) => setBlockText(current, "text", value))}
        />
      );
    case "paragraph":
      return (
        <BlockTextInput
          label="Isi paragraf"
          value={block.text}
          maxLength={MAX_BLOCK_TEXT_LENGTH}
          rows={BODY_TEXT_ROWS}
          {...field((value) => (current) => setBlockText(current, "text", value))}
        />
      );
    case "article":
      return (
        <>
          <BlockTextInput
            label="Judul pasal (nomor pasal dicetak otomatis)"
            value={block.title}
            maxLength={MAX_LABEL_LENGTH}
            {...field((value) => (current) => setBlockText(current, "title", value))}
          />
          <BlockTextInput
            label="Isi pasal"
            value={block.text}
            maxLength={MAX_BLOCK_TEXT_LENGTH}
            rows={BODY_TEXT_ROWS}
            {...field((value) => (current) => setBlockText(current, "text", value))}
          />
        </>
      );
    case "list":
      return (
        <BlockTextInput
          label={`Butir daftar — satu butir per baris (maks. ${MAX_LIST_ITEMS})`}
          value={listItemsToText(block.items)}
          maxLength={MAX_BLOCK_TEXT_LENGTH}
          rows={Math.max(MIN_LIST_ROWS, block.items.length)}
          {...field((value) => (current) => setListText(current, value))}
        />
      );
    case "signatures":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["left", "right"] as const).map((side) => (
            <div key={side} className="space-y-2">
              <BlockTextInput
                label={side === "left" ? "Label kiri" : "Label kanan"}
                value={block[side].label}
                maxLength={MAX_LABEL_LENGTH}
                {...field((value) => (current) => setSignatureText(current, side, "label", value))}
              />
              <BlockTextInput
                label={side === "left" ? "Nama kiri" : "Nama kanan"}
                value={block[side].name}
                maxLength={MAX_LABEL_LENGTH}
                {...field((value) => (current) => setSignatureText(current, side, "name", value))}
              />
            </div>
          ))}
        </div>
      );
  }
}

/** Kotak teks satu baris (tanpa `rows`) atau textarea, yang melapor saat difokus. */
function BlockTextInput({
  label,
  value,
  maxLength,
  rows,
  onValueChange,
  onTrackFocus,
}: {
  label: string;
  value: string;
  maxLength: number;
  rows?: number;
  onValueChange: (value: string) => void;
  onTrackFocus: TrackFieldFocus;
}) {
  const inputId = useId();
  const sharedProps = {
    id: inputId,
    value,
    maxLength,
    className: INPUT_CLASS,
    onChange: (event: { target: TextFieldElement }) => onValueChange(event.target.value),
    onFocus: (event: { currentTarget: TextFieldElement }) =>
      onTrackFocus(event.currentTarget, onValueChange),
  };

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400"
      >
        {label}
      </label>
      {rows ? <textarea rows={rows} {...sharedProps} /> : <input type="text" {...sharedProps} />}
    </div>
  );
}
