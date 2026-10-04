"use client";

import type { Dispatch, SetStateAction } from "react";
import { HiOutlinePlus } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import type { TemplateBlock, TemplatePlaceholder } from "../../components/legal-types";
import BlockRow, { type BlockUpdater } from "./BlockRow";
import PlaceholderMenu from "./PlaceholderMenu";
import {
  BLOCK_TYPE_LABEL,
  BLOCK_TYPE_ORDER,
  createBlock,
  MAX_TEMPLATE_BLOCKS,
  moveBlock,
} from "./template-blocks";
import { usePlaceholderInsertion } from "./usePlaceholderInsertion";

/**
 * Editor blok terbatas: daftar blok yang bisa diubah, dipindah, dan dihapus,
 * tombol tambah per tipe, serta penyisip isian {{kunci}}.
 */
export default function BlockEditor({
  blocks,
  onBlocksChange,
  placeholders,
}: {
  blocks: TemplateBlock[];
  onBlocksChange: Dispatch<SetStateAction<TemplateBlock[]>>;
  placeholders: TemplatePlaceholder[];
}) {
  const { hasTarget, trackFocus, clearTarget, insertPlaceholder } = usePlaceholderInsertion();
  const isFull = blocks.length >= MAX_TEMPLATE_BLOCKS;

  const updateBlock = (index: number, updater: BlockUpdater) =>
    onBlocksChange((current) =>
      current.map((block, position) => (position === index ? updater(block) : block)),
    );

  // Indeks blok bergeser setelah dipindah/dihapus, jadi target sisipan dilupakan.
  const restructure = (change: (current: TemplateBlock[]) => TemplateBlock[]) => {
    clearTarget();
    onBlocksChange(change);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <PlaceholderMenu
          placeholders={placeholders}
          isEnabled={hasTarget}
          onInsert={insertPlaceholder}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tulis <code className="font-mono">**teks**</code> untuk huruf tebal. Isian kosong
          tercetak titik-titik di PDF.
        </p>
      </div>

      {blocks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          Belum ada blok. Tambahkan blok pertama di bawah.
        </p>
      ) : (
        <ol className="space-y-3">
          {blocks.map((block, index) => (
            <BlockRow
              // Blok tidak punya id; indeks cukup karena pemindahan menukar isi seluruhnya.
              key={index}
              block={block}
              position={index + 1}
              controls={{
                isFirst: index === 0,
                isLast: index === blocks.length - 1,
                onUpdate: (updater) => updateBlock(index, updater),
                onMove: (offset) => restructure((current) => moveBlock(current, index, offset)),
                onRemove: () =>
                  restructure((current) => current.filter((_, position) => position !== index)),
                onTrackFocus: trackFocus,
              }}
            />
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">Tambah blok:</span>
        {BLOCK_TYPE_ORDER.map((type) => (
          <Button
            key={type}
            size="sm"
            variant="outline"
            disabled={isFull}
            onClick={() => onBlocksChange((current) => [...current, createBlock(type)])}
          >
            <HiOutlinePlus />
            {BLOCK_TYPE_LABEL[type]}
          </Button>
        ))}
        {isFull && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Batas {MAX_TEMPLATE_BLOCKS} blok tercapai.
          </span>
        )}
      </div>
    </div>
  );
}
