import { prisma } from '@/modules/database'
import { compare, hash } from 'bcryptjs'
import { Status, TipePelanggan } from '@prisma/client'
import { afterCustomerUpdate, beforeCustomerDelete } from '@/lib/hooks/radius-sync-hooks'
import { AutomaticBillingService } from '@/modules/finance/services/AutomaticBillingService'

const normalizeText = (value: string | null | undefined) => value?.trim() ?? ''

const parseEnumValue = <T extends string>(value: string | null, enumObject: Record<string, T>): T | null => {
  if (!value) return null
  const normalized = value.toUpperCase()
  return (Object.values(enumObject) as string[]).find(v => v.toUpperCase() === normalized) as T ?? null
}

const hasPasswordLoginChanged = async (existingPasswordHash: string | null, nextPasswordLogin: string | null) => {
  if (!nextPasswordLogin) return false
  if (!existingPasswordHash) return true

  try {
    return !(await compare(normalizeText(nextPasswordLogin), existingPasswordHash))
  } catch {
    return true
  }
}

export type UpdatePppByIdInput = {
  id: string
  existingStatus: Status
  data: {
    idPelanggan: string
    nama: string
    username: string
    password: string
    hargaPaketId: string
    tipe: string | null
    tanggalAktif: Date
    jatuhTempo: Date
    status: string | null
    autoIsolir: boolean
    email: string | null
    siteId: string | null
    invoiceAction: string | null
    passwordLogin: string | null
  }
}

export class PelangganAdminMutationService {
  async updatePppById(input: UpdatePppByIdInput) {
    const { id, existingStatus, data } = input

    const existingPelanggan = await prisma.pelanggan.findUnique({
      where: { id },
      select: {
        id: true,
        password: true,
        passwordHash: true,
        hargaPaketId: true,
        tipe: true,
        status: true,
        autoIsolir: true,
      },
    })

    if (!existingPelanggan) {
      throw new Error('Pelanggan tidak ditemukan')
    }

    const nextIdPelanggan = normalizeText(data.idPelanggan)
    const nextNama = normalizeText(data.nama)
    const nextUsername = normalizeText(data.username)
    const nextPassword = normalizeText(data.password)
    const nextHargaPaketId = data.hargaPaketId
    const nextTipe = parseEnumValue(data.tipe, TipePelanggan) ?? TipePelanggan.REGULER
    const nextStatus = parseEnumValue(data.status, Status) ?? Status.AKTIF
    const nextEmail = normalizeText(data.email) || null
    const nextSiteId = data.siteId
    const nextPasswordLogin = normalizeText(data.passwordLogin)
    const nextPasswordHash = nextPasswordLogin ? await hash(nextPasswordLogin, 12) : null
    const passwordLoginChanged = await hasPasswordLoginChanged(existingPelanggan.passwordHash ?? null, nextPasswordLogin || null)

    const pelanggan = await prisma.pelanggan.update({
      where: { id },
      data: {
        idPelanggan: nextIdPelanggan,
        nama: nextNama,
        username: nextUsername,
        password: nextPassword,
        hargaPaketId: nextHargaPaketId,
        tipe: nextTipe,
        tanggalAktif: data.tanggalAktif,
        jatuhTempo: data.jatuhTempo,
        status: nextStatus,
        autoIsolir: data.autoIsolir,
        email: nextEmail,
        siteId: nextSiteId,
        ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
      },
    })

    await afterCustomerUpdate(prisma, id, {
      statusChanged: existingPelanggan.status !== pelanggan.status,
      oldStatus: existingStatus,
      newStatus: pelanggan.status,
      packageChanged:
        existingPelanggan.hargaPaketId !== nextHargaPaketId ||
        existingPelanggan.tipe !== nextTipe,
      passwordChanged:
        existingPelanggan.password !== nextPassword ||
        passwordLoginChanged,
    })

    if (data.invoiceAction === 'VOID_AND_CREATE_NEW') {
      await AutomaticBillingService.generateImmediateInvoice(pelanggan.id, false)
    }

    return pelanggan
  }

  async deletePppById(id: string, username: string) {
    await beforeCustomerDelete(prisma, username)
    return prisma.pelanggan.delete({ where: { id } })
  }
}
