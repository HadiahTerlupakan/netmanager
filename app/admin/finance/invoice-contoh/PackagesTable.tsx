"use client";

import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import type { SampleAddon, SamplePackage } from "@/modules/sample-invoice";
import {
  type DiscountDraft,
  DiscountRow,
  emptyDiscount,
  toDiscount,
} from "./DiscountRow";
import { inputClass } from "./ui";

type AddonRow = { name: string; price: string };
type Row = {
  name: string;
  speed: string;
  price: string;
  addons: AddonRow[];
  discount: DiscountDraft | null;
};

export const emptyPackageRow = (): Row => ({
  name: "",
  speed: "",
  price: "",
  addons: [],
  discount: null,
});

const validPrice = (price: number) => Number.isInteger(price) && price > 0;

/**
 * Paket yang valid: nama terisi dan harga bilangan bulat lebih dari 0.
 * Add-on dan diskon yang belum lengkap dilewati; field-nya hanya ada bila
 * terisi.
 */
export function toPackages(rows: Row[]): SamplePackage[] {
  return rows
    .map((row) => {
      const addons: SampleAddon[] = row.addons
        .map((addon) => ({
          name: addon.name.trim(),
          price: Number(addon.price),
        }))
        .filter((addon) => addon.name && validPrice(addon.price));
      const discount = toDiscount(row.discount);
      return {
        name: row.name.trim(),
        speed: row.speed.trim(),
        price: Number(row.price),
        ...(addons.length > 0 ? { addons } : {}),
        ...(discount ? { discount } : {}),
      };
    })
    .filter((pkg) => pkg.name && validPrice(pkg.price));
}

const deleteButtonClass =
  "flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-red-500/10";

function PriceInput(props: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
        Rp
      </span>
      <input
        name={props.name}
        aria-label={props.label}
        className={`${inputClass} pl-9 text-right tabular-nums`}
        placeholder="0"
        inputMode="numeric"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value.replace(/\D/g, ""))}
      />
    </div>
  );
}

function PackageBlock(props: {
  row: Row;
  index: number;
  canRemove: boolean;
  onChange: (row: Row) => void;
  onRemove: () => void;
}) {
  const { row, index } = props;
  const setAddon = (at: number, addon: AddonRow) =>
    props.onChange({
      ...row,
      addons: row.addons.map((item, i) => (i === at ? addon : item)),
    });

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="grid grid-cols-[1fr_2.5rem] gap-2 sm:grid-cols-[1fr_9rem_11rem_2.5rem]">
        <input
          name={`package-${index}-name`}
          aria-label="Nama paket"
          className={`${inputClass} col-span-2 sm:col-span-1`}
          placeholder="Nama paket, mis. Home 20"
          value={row.name}
          onChange={(e) => props.onChange({ ...row, name: e.target.value })}
        />
        <input
          name={`package-${index}-speed`}
          aria-label="Kecepatan"
          className={inputClass}
          placeholder="20 Mbps"
          value={row.speed}
          onChange={(e) => props.onChange({ ...row, speed: e.target.value })}
        />
        <PriceInput
          name={`package-${index}-price`}
          label="Harga paket per bulan"
          value={row.price}
          onChange={(price) => props.onChange({ ...row, price })}
        />
        <button
          type="button"
          aria-label="Hapus paket"
          title="Hapus paket"
          className={deleteButtonClass}
          disabled={!props.canRemove}
          onClick={props.onRemove}
        >
          <HiOutlineTrash className="h-5 w-5" />
        </button>
      </div>

      {row.addons.map((addon, at) => (
        <div
          key={at}
          className="grid grid-cols-[1fr_9rem_2.5rem] gap-2 border-l-2 border-indigo-200 pl-3 sm:ml-4 sm:grid-cols-[1fr_11rem_2.5rem] dark:border-indigo-500/30"
        >
          <input
            name={`package-${index}-addon-${at}-name`}
            aria-label="Nama add-on"
            className={inputClass}
            placeholder="Add-on, mis. Sewa modem"
            value={addon.name}
            onChange={(e) => setAddon(at, { ...addon, name: e.target.value })}
          />
          <PriceInput
            name={`package-${index}-addon-${at}-price`}
            label="Harga add-on per bulan"
            value={addon.price}
            onChange={(price) => setAddon(at, { ...addon, price })}
          />
          <button
            type="button"
            aria-label="Hapus add-on"
            title="Hapus add-on"
            className={deleteButtonClass}
            onClick={() =>
              props.onChange({
                ...row,
                addons: row.addons.filter((_, i) => i !== at),
              })
            }
          >
            <HiOutlineTrash className="h-5 w-5" />
          </button>
        </div>
      ))}

      {row.discount && (
        <DiscountRow
          packageIndex={index}
          draft={row.discount}
          gross={row.addons.reduce(
            (sum, addon) => sum + (Number(addon.price) || 0),
            Number(row.price) || 0,
          )}
          deleteButtonClass={deleteButtonClass}
          onChange={(discount) => props.onChange({ ...row, discount })}
          onRemove={() => props.onChange({ ...row, discount: null })}
        />
      )}

      <div className="flex gap-4">
        <Button
          type="button"
          size="sm"
          variant="link"
          className="h-7 px-0"
          onClick={() =>
            props.onChange({
              ...row,
              addons: [...row.addons, { name: "", price: "" }],
            })
          }
        >
          <HiOutlinePlus />
          Tambah add-on
        </Button>
        {!row.discount && (
          <Button
            type="button"
            size="sm"
            variant="link"
            className="h-7 px-0 text-green-700 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
            onClick={() =>
              props.onChange({ ...row, discount: emptyDiscount() })
            }
          >
            <HiOutlinePlus />
            Tambah diskon
          </Button>
        )}
      </div>
    </div>
  );
}

export function PackagesTable({
  rows,
  onChange,
}: {
  rows: Row[];
  onChange: (rows: Row[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[1fr_9rem_11rem_2.5rem] gap-2 px-4 text-xs font-medium uppercase tracking-wide text-gray-500 sm:grid dark:text-gray-400">
        <span>Nama paket</span>
        <span>Kecepatan</span>
        <span>Harga / bulan</span>
        <span />
      </div>
      {rows.map((row, index) => (
        <PackageBlock
          key={index}
          row={row}
          index={index}
          canRemove={rows.length > 1}
          onChange={(next) =>
            onChange(rows.map((item, i) => (i === index ? next : item)))
          }
          onRemove={() => onChange(rows.filter((_, i) => i !== index))}
        />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChange([...rows, emptyPackageRow()])}
        >
          <HiOutlinePlus /> Tambah paket
        </Button>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Setiap pelanggan mendapat satu paket acak beserta add-on dan
          diskonnya, tetap di semua bulan.
        </p>
      </div>
    </div>
  );
}
