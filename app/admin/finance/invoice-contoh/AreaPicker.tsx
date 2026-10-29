"use client";

import { PenandaUniversal } from "@/components/map/PenandaUniversal";
import { PetaUniversal } from "@/components/map/PetaUniversal";
import { Field, inputClass } from "./ui";

const DEFAULT_CENTER = { lat: -6.5091, lng: 107.1352 };

export type StreetTone = "idle" | "busy" | "ok" | "warn";

const TONE_CLASS: Record<StreetTone, string> = {
  idle: "bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300",
  busy: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  ok: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export function AreaPicker(props: {
  center: { lat: number; lng: number } | null;
  radiusKm: string;
  onRadiusChange: (value: string) => void;
  onRadiusCommit: () => void;
  onPick: (point: { lat: number; lng: number }) => void;
  status: string;
  tone: StreetTone;
}) {
  return (
    <div className="space-y-3">
      <div className="h-80 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <PetaUniversal
          pusat={props.center ?? DEFAULT_CENTER}
          zoom={13}
          onKlik={(lat, lng) => props.onPick({ lat, lng })}
        >
          {props.center && (
            <PenandaUniversal
              posisi={props.center}
              type="lokasi"
              title={`Pusat, radius ${props.radiusKm} km`}
            />
          )}
        </PetaUniversal>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Radius (km)" hint="0,2 sampai 10 km" className="w-40">
          <input
            name="radiusKm"
            className={inputClass}
            inputMode="decimal"
            value={props.radiusKm}
            onChange={(e) =>
              props.onRadiusChange(e.target.value.replace(",", "."))
            }
            onBlur={props.onRadiusCommit}
          />
        </Field>
        <p
          className={`mb-5 rounded-full px-3 py-1.5 text-sm ${TONE_CLASS[props.tone]}`}
        >
          {props.status || "Klik peta untuk memilih titik pusat area"}
        </p>
      </div>
    </div>
  );
}
