import { Prisma } from "@prisma/client";

/** Select relasi pelanggan untuk detail work order. */
export const WORK_ORDER_CUSTOMER_SELECT = {
  id: true,
  idPelanggan: true,
  nama: true,
  email: true,
  noTelp: true,
  alamat: true,
} satisfies Prisma.PelangganSelect;

/** Select relasi site untuk detail work order. */
export const WORK_ORDER_SITE_SELECT = {
  id: true,
  code: true,
  name: true,
} satisfies Prisma.SitesSelect;

/** Select relasi departemen untuk detail work order. */
export const WORK_ORDER_DEPARTMENT_SELECT = {
  id: true,
  name: true,
} satisfies Prisma.DepartmentsSelect;

/** Select relasi assignee untuk detail work order. */
export const WORK_ORDER_ASSIGNEE_SELECT = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

/** Include relasi assignment work order. */
export const WORK_ORDER_ASSIGNMENTS_INCLUDE = {
  include: {
    user: {
      select: { id: true, name: true },
    },
  },
} satisfies Prisma.WorkOrderAssignmentsFindManyArgs;

/** Include relasi update work order. */
export const WORK_ORDER_UPDATES_INCLUDE = {
  include: {
    user: {
      select: { id: true, name: true, email: true },
    },
  },
  orderBy: { createdAt: "desc" },
} satisfies Prisma.WorkOrderUpdatesFindManyArgs;

/** Include relasi lampiran work order. */
export const WORK_ORDER_ATTACHMENTS_INCLUDE = {
  include: {
    user: {
      select: { id: true, name: true, email: true },
    },
  },
  orderBy: { uploadedAt: "desc" },
} satisfies Prisma.WorkOrderAttachmentsFindManyArgs;

/** Include lengkap detail work order. */
export const WORK_ORDER_DETAIL_INCLUDE = {
  pelanggan: { select: WORK_ORDER_CUSTOMER_SELECT },
  site: { select: WORK_ORDER_SITE_SELECT },
  department: { select: WORK_ORDER_DEPARTMENT_SELECT },
  assignedTo: { select: WORK_ORDER_ASSIGNEE_SELECT },
  tasks: { orderBy: { order: "asc" } },
  assignments: WORK_ORDER_ASSIGNMENTS_INCLUDE,
  updates: WORK_ORDER_UPDATES_INCLUDE,
  attachments: WORK_ORDER_ATTACHMENTS_INCLUDE,
  materials: {
    include: {
      barang: {
        select: { id: true, kode: true, nama: true, satuan: true },
      },
    },
  },
  createdBy: { select: { id: true, name: true } },
  ticket: { select: { ticketNumber: true } },
} satisfies Prisma.WorkOrdersInclude;

/** Select ringkas untuk list work order. */
export const WORK_ORDER_LIST_SELECT = {
  id: true,
  workOrderNumber: true,
  title: true,
  description: true,
  type: true,
  status: true,
  priority: true,
  scheduledDate: true,
  contactName: true,
  contactPhone: true,
  locationAddress: true,
  isInternal: true,
  requestedById: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  pelanggan: {
    select: { id: true, idPelanggan: true, nama: true, noTelp: true },
  },
  site: {
    select: { id: true, name: true, code: true },
  },
  department: {
    select: { id: true, name: true },
  },
  assignedTo: {
    select: { id: true, name: true, role: { select: { isTechnical: true } } },
  },
  createdBy: {
    select: { id: true, name: true, role: { select: { isTechnical: true } } },
  },
} satisfies Prisma.WorkOrdersSelect;

/** Select ringkas untuk summary list work order. */
export const WORK_ORDER_LIST_SUMMARY_SELECT = {
  status: true,
  type: true,
  title: true,
  startedAt: true,
  completedAt: true,
  contactName: true,
  contactPhone: true,
  pelanggan: { select: { nama: true, noTelp: true } },
  site: { select: { name: true } },
} satisfies Prisma.WorkOrdersSelect;
