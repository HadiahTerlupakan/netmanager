export type WoType = "CUSTOMER" | "INTERNAL";

export type WorkOrderFormData = {
  ticketId: string;
  pelangganId: string;
  siteId: string;
  departmentId: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  locationAddress: string;
  contactName: string;
  contactPhone: string;
  scheduledDate: string;
  scheduledTimeStart: string;
  scheduledTimeEnd: string;
  disconnectionReason: string;
  templateId: string;
};

export type SiteRef = { id: string; code: string; name: string };
export type DepartmentRef = { id: string; name: string };

export interface BuildWorkOrderPayloadInput {
  formData: WorkOrderFormData;
  woType: WoType;
  isGuest: boolean;
  sites: SiteRef[];
  departments: DepartmentRef[];
}

export interface WorkOrderPayload {
  ticketId: string | undefined;
  pelangganId: string | undefined;
  siteId: string | undefined;
  departmentId: string | undefined;
  type: string;
  title: string;
  description: string;
  priority: string;
  isInternal: boolean;
  locationAddress: string | undefined;
  contactName: string | undefined;
  contactPhone: string | undefined;
  scheduledDate: Date | undefined;
  scheduledTimeStart: string | undefined;
  scheduledTimeEnd: string | undefined;
  disconnectionReason: string | undefined;
  templateId: string | undefined;
}

const INTERNAL_FALLBACK_CONTACT = "Internal Team";
const GUEST_CONTACT_FALLBACK = "Guest";

/**
 * Bangun payload POST /api/admin/workorders dari state form.
 *
 * Aturan utama: kirim `undefined` (bukan `null`) untuk field opsional
 * agar lolos validasi Zod (`z.string().optional()` = string|undefined).
 * Fungsi ini pure & testable — tidak menyentuh DOM atau jaringan.
 */
export function buildWorkOrderPayload(
  input: BuildWorkOrderPayloadInput,
): WorkOrderPayload {
  const { formData, woType, isGuest, sites, departments } = input;
  const isInternal = woType === "INTERNAL";

  const selectedSite = sites.find((s) => s.id === formData.siteId);
  const selectedDepartment = departments.find(
    (d) => d.id === formData.departmentId,
  );

  return {
    ticketId: formData.ticketId || undefined,
    pelangganId: resolvePelangganId({
      isInternal,
      isGuest,
      pelangganId: formData.pelangganId,
    }),
    siteId: formData.siteId || undefined,
    departmentId: formData.departmentId || undefined,
    type: formData.type,
    title: formData.title,
    description: formData.description,
    priority: formData.priority,
    isInternal,
    locationAddress: resolveLocationAddress({
      isInternal,
      selectedSite,
      formAddress: formData.locationAddress,
    }),
    contactName: resolveContactName({
      isInternal,
      isGuest,
      selectedDepartment,
      formContactName: formData.contactName,
    }),
    contactPhone: formData.contactPhone || undefined,
    scheduledDate: formData.scheduledDate
      ? new Date(formData.scheduledDate)
      : undefined,
    scheduledTimeStart: formData.scheduledTimeStart || undefined,
    scheduledTimeEnd: formData.scheduledTimeEnd || undefined,
    disconnectionReason: formData.disconnectionReason || undefined,
    templateId: formData.templateId || undefined,
  };
}

function resolvePelangganId(input: {
  isInternal: boolean;
  isGuest: boolean;
  pelangganId: string;
}): string | undefined {
  if (input.isInternal) return undefined;
  if (input.isGuest) return undefined;
  return input.pelangganId || undefined;
}

function resolveLocationAddress(input: {
  isInternal: boolean;
  selectedSite: SiteRef | undefined;
  formAddress: string;
}): string | undefined {
  if (input.isInternal) {
    if (input.selectedSite) {
      return `Site: ${input.selectedSite.code} - ${input.selectedSite.name}`;
    }
    return input.formAddress || undefined;
  }
  return input.formAddress || undefined;
}

function resolveContactName(input: {
  isInternal: boolean;
  isGuest: boolean;
  selectedDepartment: DepartmentRef | undefined;
  formContactName: string;
}): string | undefined {
  if (input.isInternal) {
    return input.selectedDepartment?.name || INTERNAL_FALLBACK_CONTACT;
  }
  if (input.formContactName) return input.formContactName;
  if (input.isGuest) return GUEST_CONTACT_FALLBACK;
  return undefined;
}
