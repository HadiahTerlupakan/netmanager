import { tentukanPredikat } from "@/modules/presurvei/client";

import { Badge } from "../rencana/BadgeRencana";
import { tampilanPredikat, teksSkor, warnaBilah, type BarisIndikator } from "./tampilanPenilaian";

const PERSEN_PENUH = 100;

/** Skor besar + badge predikat. */
export function SkorPredikat({
  skor,
  predikat,
}: {
  skor: number | null;
  predikat: Parameters<typeof tampilanPredikat>[0];
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
      <span className="text-2xl font-bold text-gray-900 dark:text-white">{teksSkor(skor)}</span>
      <Badge tampilan={tampilanPredikat(predikat)} />
    </div>
  );
}

/** Daftar indikator: label, bobot, bilah nilai. */
export function DaftarBilahIndikator({ daftar }: { daftar: readonly BarisIndikator[] }) {
  return (
    <ul className="space-y-2">
      {daftar.map((baris) => (
        <li key={baris.kunci}>
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
            <span>
              {baris.label} <span className="text-gray-400">· bobot {baris.bobot}%</span>
            </span>
            <span className="font-medium">{baris.nilai === null ? "belum terukur" : baris.nilai}</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
            {baris.nilai !== null && (
              <div
                className={`h-1.5 rounded-full ${warnaBilah(baris.nilai, tentukanPredikat)}`}
                style={{ width: `${Math.min(baris.nilai, PERSEN_PENUH)}%` }}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
