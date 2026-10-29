"use client";

import { useRef, useState } from "react";
import type {
  PpnMode,
  SampleGenerateInput,
  SampleIssuer,
  SampleInvoiceLimits,
  SampleStreet,
} from "@/modules/sample-invoice";
import type { fetchStreets as FetchStreets } from "./overpass";
import { AreaPicker, type StreetTone } from "./AreaPicker";
import { GenerateSummary } from "./GenerateSummary";
import { emptyPackageRow, PackagesTable, toPackages } from "./PackagesTable";
import { PayDateField } from "./PayDateField";
import { Field, formatMonthRange, inputClass as field, Section } from "./ui";

const MIN_STREETS = 5;

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
  const [streetTone, setStreetTone] = useState<StreetTone>("idle");
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
      setStreetTone("warn");
      return;
    }
    const id = ++lookupId.current;
    setStreets([]);
    setStreetStatus("Mencari jalan bernama di OpenStreetMap…");
    setStreetTone("busy");
    const result = await props.fetchStreets(point, radius);
    if (id !== lookupId.current) return;
    if ("message" in result) {
      setStreetStatus(result.message);
      setStreetTone("warn");
      return;
    }
    setStreets(result.streets);
    setStreetTone(result.streets.length >= MIN_STREETS ? "ok" : "warn");
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
  const missing = [
    !mitra && "Pilih mitra",
    !issuer.name.trim() && "Isi nama perusahaan penerbit",
    packages.length === 0 && "Isi minimal satu paket dengan harga",
    customerCount < 1 && "Isi jumlah pelanggan",
    !center && "Klik peta untuk titik pusat area",
    center && streets.length < MIN_STREETS && "Tunggu atau perluas area jalan",
  ].filter((item): item is string => Boolean(item));
  const ready = missing.length === 0 && !problem && !submitting;
  const pdfCount = customerCount * Math.max(months, 0);

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
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <Section
          step={1}
          title="Mitra & penerbit"
          hint="Nama penerbit tercetak di kepala setiap invoice."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Mitra">
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
            </Field>
            <Field label="Nama perusahaan penerbit">
              <input
                name="issuerName"
                className={field}
                value={issuer.name}
                onChange={(e) => setIssuer({ ...issuer, name: e.target.value })}
              />
            </Field>
            <Field label="Alamat penerbit">
              <input
                name="issuerAddress"
                className={field}
                value={issuer.address}
                onChange={(e) =>
                  setIssuer({ ...issuer, address: e.target.value })
                }
              />
            </Field>
            <Field label="Telepon penerbit">
              <input
                name="issuerPhone"
                className={field}
                inputMode="tel"
                value={issuer.phone}
                onChange={(e) =>
                  setIssuer({ ...issuer, phone: e.target.value })
                }
              />
            </Field>
          </div>
        </Section>

        <Section
          step={2}
          title="Paket & pelanggan"
          hint="Harga diisi per bulan; pelanggan dibagi acak ke paket-paket ini."
        >
          <PackagesTable rows={rows} onChange={setRows} />
          <Field
            label="Jumlah pelanggan"
            hint={`Maksimal ${props.limits.maxCustomers.toLocaleString("id-ID")}`}
            className="mt-5 max-w-xs"
          >
            <input
              name="customerCount"
              className={field}
              inputMode="numeric"
              value={customers}
              onChange={(e) => setCustomers(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
        </Section>

        <Section
          step={3}
          title="Periode & pembayaran"
          hint="Satu invoice per pelanggan per bulan, semuanya berstatus lunas."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Dari bulan">
              <input
                name="fromMonth"
                type="month"
                className={field}
                max={props.currentMonth}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="Sampai bulan">
              <input
                name="toMonth"
                type="month"
                className={field}
                max={props.currentMonth}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
            <Field label="Jatuh tempo" hint="Tanggal 1–28 setiap bulan">
              <input
                name="dueDay"
                type="number"
                min={1}
                max={28}
                className={field}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
            </Field>
            <Field label="PPN 11%">
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
            </Field>
          </div>
          <PayDateField
            mode={payMode}
            day={payDay}
            onModeChange={setPayMode}
            onDayChange={setPayDay}
          />
        </Section>

        <Section
          step={4}
          title="Area alamat pelanggan"
          hint="Klik peta untuk titik pusat. Alamat diambil dari nama jalan asli OpenStreetMap di dalam radius."
        >
          <AreaPicker
            center={center}
            radiusKm={radiusKm}
            onRadiusChange={setRadiusKm}
            onRadiusCommit={() => center && void lookupStreets(center, radiusM)}
            onPick={(point) => {
              setCenter(point);
              void lookupStreets(point, radiusM);
            }}
            status={streetStatus}
            tone={streetTone}
          />
        </Section>
      </div>

      <GenerateSummary
        rows={[
          ["Mitra", mitra?.name ?? "—"],
          ["Paket", `${packages.length} paket`],
          ["Pelanggan", customerCount.toLocaleString("id-ID")],
          [
            "Periode",
            months > 0 ? `${formatMonthRange(from, to)} (${months} bln)` : "—",
          ],
          ["Jalan ditemukan", streets.length.toLocaleString("id-ID")],
        ]}
        pdfCount={pdfCount}
        missing={missing}
        problem={problem}
        ready={ready}
        submitting={submitting}
        onSubmit={submit}
      />
    </div>
  );
}
