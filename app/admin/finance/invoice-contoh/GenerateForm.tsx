"use client";

import { useRef, useState } from "react";
import { PenandaUniversal } from "@/components/map/PenandaUniversal";
import { PetaUniversal } from "@/components/map/PetaUniversal";
import type {
  PpnMode,
  SampleGenerateInput,
  SampleIssuer,
  SampleInvoiceLimits,
  SampleStreet,
} from "@/modules/sample-invoice";
import type { fetchStreets as FetchStreets } from "./overpass";
import { emptyPackageRow, PackagesTable, toPackages } from "./PackagesTable";

const DEFAULT_CENTER = { lat: -6.5091, lng: 107.1352 };
const MIN_STREETS = 5;
const field = "w-full rounded border px-2 py-1 text-sm dark:bg-gray-900";

type Props = {
  mitras: Array<{ id: string; name: string }>;
  issuer: SampleIssuer;
  limits: SampleInvoiceLimits;
  /** "YYYY-MM" menurut WIB */
  currentMonth: string;
  fetchStreets: typeof FetchStreets;
  onSubmit: (input: SampleGenerateInput) => Promise<void>;
};

function monthCount(from: string, to: string) {
  const index = (month: string) => {
    const [year, mon] = month.split("-").map(Number);
    return year * 12 + mon;
  };
  return from && to ? index(to) - index(from) + 1 : 0;
}

function rangeProblem(p: {
  customers: number;
  months: number;
  from: string;
  to: string;
  currentMonth: string;
  limits: SampleInvoiceLimits;
}) {
  if (p.to > p.currentMonth)
    return "Bulan akhir tidak boleh melewati bulan berjalan";
  if (p.months < 1)
    return "Bulan awal harus sebelum atau sama dengan bulan akhir";
  if (p.customers > p.limits.maxCustomers)
    return `Jumlah pelanggan melewati batas ${p.limits.maxCustomers}`;
  if (p.months > p.limits.maxMonths)
    return `Rentang bulan melewati batas ${p.limits.maxMonths} bulan`;
  if (p.customers * p.months > p.limits.maxPdfs)
    return `Jumlah PDF melewati batas ${p.limits.maxPdfs}`;
  return null;
}

export function GenerateForm(props: Props) {
  const [mitraId, setMitraId] = useState("");
  const [issuer, setIssuer] = useState(props.issuer);
  const [rows, setRows] = useState([emptyPackageRow()]);
  const [customers, setCustomers] = useState("50");
  const [from, setFrom] = useState(props.currentMonth);
  const [to, setTo] = useState(props.currentMonth);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [radiusKm, setRadiusKm] = useState("2");
  const [dueDay, setDueDay] = useState("10");
  const [payMode, setPayMode] = useState<"random" | "fixed">("random");
  const [payDay, setPayDay] = useState("5");
  const [ppn, setPpn] = useState<PpnMode>("inclusive");
  const [streets, setStreets] = useState<SampleStreet[]>([]);
  const [streetStatus, setStreetStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const radiusM = Math.round(Number(radiusKm) * 1000);
  const lookupId = useRef(0);

  // Dipanggil dari klik peta dan saat radius selesai diubah; jawaban dari
  // pencarian yang sudah digantikan diabaikan.
  async function lookupStreets(
    point: { lat: number; lng: number },
    radius: number,
  ) {
    if (radius < 200 || radius > 10000) {
      setStreets([]);
      setStreetStatus("Radius harus 0,2 sampai 10 km");
      return;
    }
    const id = ++lookupId.current;
    setStreets([]);
    setStreetStatus("Mencari jalan bernama di OpenStreetMap…");
    const result = await props.fetchStreets(point, radius);
    if (id !== lookupId.current) return;
    if ("message" in result) {
      setStreetStatus(result.message);
      return;
    }
    setStreets(result.streets);
    setStreetStatus(
      result.streets.length >= MIN_STREETS
        ? `${result.streets.length} jalan bernama ditemukan`
        : `Hanya ${result.streets.length} jalan bernama ditemukan; perbesar radius`,
    );
  }

  const packages = toPackages(rows);
  const customerCount = Number(customers) || 0;
  const months = monthCount(from, to);
  const problem = rangeProblem({
    customers: customerCount,
    months,
    from,
    to,
    currentMonth: props.currentMonth,
    limits: props.limits,
  });
  const mitra = props.mitras.find((item) => item.id === mitraId);
  const ready =
    Boolean(mitra && issuer.name.trim() && center) &&
    packages.length > 0 &&
    customerCount >= 1 &&
    streets.length >= MIN_STREETS &&
    !problem &&
    !submitting;

  async function submit() {
    if (!ready || !mitra || !center) return;
    setSubmitting(true);
    try {
      await props.onSubmit({
        mitraId: mitra.id,
        mitraName: mitra.name,
        issuer,
        packages,
        customerCount,
        fromMonth: from,
        toMonth: to,
        center,
        radiusM,
        dueDay: Number(dueDay),
        payDate:
          payMode === "fixed"
            ? { mode: "fixed", day: Number(payDay) }
            : { mode: "random" },
        ppn,
        streets,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 rounded-lg border p-4 dark:border-gray-700">
      <section className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          Mitra
          <select
            name="mitraId"
            className={field}
            value={mitraId}
            onChange={(e) => setMitraId(e.target.value)}
          >
            <option value="">Pilih mitra</option>
            {props.mitras.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Nama perusahaan penerbit
          <input
            name="issuerName"
            className={field}
            value={issuer.name}
            onChange={(e) => setIssuer({ ...issuer, name: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Alamat penerbit
          <input
            name="issuerAddress"
            className={field}
            value={issuer.address}
            onChange={(e) => setIssuer({ ...issuer, address: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Telepon penerbit
          <input
            name="issuerPhone"
            className={field}
            value={issuer.phone}
            onChange={(e) => setIssuer({ ...issuer, phone: e.target.value })}
          />
        </label>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Paket</h3>
        <PackagesTable rows={rows} onChange={setRows} />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          Jumlah pelanggan
          <input
            name="customerCount"
            className={field}
            inputMode="numeric"
            value={customers}
            onChange={(e) => setCustomers(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <label className="text-sm">
          Dari bulan
          <input
            name="fromMonth"
            type="month"
            className={field}
            max={props.currentMonth}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Sampai bulan
          <input
            name="toMonth"
            type="month"
            className={field}
            max={props.currentMonth}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          Area alamat — klik peta untuk titik pusat
        </h3>
        <div className="h-72 overflow-hidden rounded border">
          <PetaUniversal
            pusat={center ?? DEFAULT_CENTER}
            zoom={13}
            onKlik={(lat, lng) => {
              setCenter({ lat, lng });
              void lookupStreets({ lat, lng }, radiusM);
            }}
          >
            {center && (
              <PenandaUniversal
                posisi={center}
                type="lokasi"
                title={`Pusat, radius ${radiusKm} km`}
              />
            )}
          </PetaUniversal>
        </div>
        <label className="block text-sm">
          Radius (km, 0,2–10)
          <input
            name="radiusKm"
            className={field}
            inputMode="decimal"
            value={radiusKm}
            onChange={(e) => setRadiusKm(e.target.value.replace(",", "."))}
            onBlur={() => center && void lookupStreets(center, radiusM)}
          />
        </label>
        {streetStatus && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {streetStatus}
          </p>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          Jatuh tempo (tanggal 1–28)
          <input
            name="dueDay"
            type="number"
            min={1}
            max={28}
            className={field}
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
          />
        </label>
        <fieldset className="text-sm">
          <legend>Tanggal bayar</legend>
          <label className="mr-3">
            <input
              type="radio"
              checked={payMode === "random"}
              onChange={() => setPayMode("random")}
            />{" "}
            Acak dalam bulan
          </label>
          <label>
            <input
              type="radio"
              checked={payMode === "fixed"}
              onChange={() => setPayMode("fixed")}
            />{" "}
            Seragam, tanggal
          </label>
          {payMode === "fixed" && (
            <input
              name="payDay"
              type="number"
              min={1}
              max={28}
              className={`${field} mt-1`}
              value={payDay}
              onChange={(e) => setPayDay(e.target.value)}
            />
          )}
        </fieldset>
        <label className="text-sm">
          PPN 11%
          <select
            name="ppn"
            className={field}
            value={ppn}
            onChange={(e) => setPpn(e.target.value as PpnMode)}
          >
            <option value="none">Tanpa PPN</option>
            <option value="inclusive">Sudah termasuk harga paket</option>
            <option value="exclusive">Ditambahkan ke harga</option>
          </select>
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">
          Jumlah PDF:{" "}
          {(customerCount * Math.max(months, 0)).toLocaleString("id-ID")}
        </span>
        {problem && (
          <span role="alert" className="text-sm text-red-600">
            {problem}
          </span>
        )}
        <button
          type="button"
          className="ml-auto rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!ready}
          onClick={submit}
        >
          {submitting ? "Memproses…" : "Generate & unduh ZIP"}
        </button>
      </div>
    </div>
  );
}
