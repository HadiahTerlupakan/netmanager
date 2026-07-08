import type {
  DiscountType,
  DurasiUnit,
  Status,
  TipePelanggan,
} from "@prisma/client";

export interface CreatePelangganInput {
  idPelanggan: string;
  nama: string;
  username: string;
  password: string;
  passwordLogin: string;
  hargaPaketId: string;
  tenantId?: string | null;
  resellerId?: string | null;
  resellerOutletId?: string | null;
  tipe: TipePelanggan;
  tanggalAktif: string;
  jatuhTempo: string;
  status: Status;
  autoIsolir?: boolean;
  alamat?: string | null;
  provinsi?: string | null;
  kabupatenKota?: string | null;
  kelurahanDesa?: string | null;
  kecamatan?: string | null;
  noTelp?: string | null;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  jenisDokumen?: string | null;
  noDokumen?: string | null;
  fileKTP?: string | null;
  fileRumahSekitar?: string | null;
  fileBAST?: string | null;
  catatan?: string | null;
  usePPN?: boolean;
  useDiscount?: boolean;
  useProrate?: boolean;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  discountDuration?: number | null;
  discountDurationUnit?: DurasiUnit | null;
  biayaInstalasi?: number | null;
  biayaInstalasiIsRecurring?: boolean;
  biayaInstalasiDiskon?: number | null;
  biayaSewaPerangkat?: number | null;
  biayaSewaPerangkatIsRecurring?: boolean;
  biayaSewaPerangkatDiskon?: number | null;
  biayaLainnya?: number | null;
  biayaLainnyaIsRecurring?: boolean;
  biayaLainnyaDiskon?: number | null;
  keteranganBiayaLainnya?: string | null;
  odpId?: string | null;
  siteId?: string | null;
  billingAction?:
    | "CREATE_PAID_INVOICE"
    | "CREATE_UNPAID_INVOICE"
    | "DO_NOTHING";
}
