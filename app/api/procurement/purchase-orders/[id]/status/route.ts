
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, hasPermission } from '@/lib/auth'
import { InventoryRepository } from '@/modules/inventory/repositories/InventoryRepository'

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Use verifyAuth for API routes
        // We cast req to any or NextRequest if strict typing allows, or just pass req as any
        const session = await verifyAuth(req as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const body = await req.json()
        const { action, items, closePO } = body

        // Verify PO exists
        const po = await prisma.purchaseOrder.findUnique({
            where: { id },
             include: { 
                items: {
                    include: { barang: true }
                } 
            }
        })

        if (!po) {
            return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 })
        }

        // Action: START SHOPPING (Draft -> Ordered)
        if (action === 'START_SHOPPING') {
            const hasAccess = await hasPermission(session.id, 'purchase_orders', 'update')
            if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

            if (po.status !== 'DRAFT') {
                return NextResponse.json({ error: 'Hanya PO Draft yang bisa mulai diproses' }, { status: 400 })
            }

            const updated = await prisma.purchaseOrder.update({
                where: { id },
                data: {
                    status: 'ORDERED',
                    processedById: session.id,
                    updatedAt: new Date()
                }
            })

            // TODO: Maybe log activity/notification here
            
            return NextResponse.json(updated)
        }

        // Action: RECEIVE GOODS (Ordered -> Accepted -> Completed)
        if (action === 'RECEIVE') {
            // Check for 'receive' permission, fallback to 'update' if not strictly separate
            let hasAccess = await hasPermission(session.id, 'purchase_orders', 'receive')
            if (!hasAccess) {
                 // Fallback: If user has 'update' they should likely be able to receive too unless strictly separated
                 hasAccess = await hasPermission(session.id, 'purchase_orders', 'update')
            }
            
            if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

            if (po.status !== 'ORDERED' && po.status !== 'PARTIAL') {
                 return NextResponse.json({ error: 'Hanya PO dalam proses yang bisa diterima' }, { status: 400 })
            }

            // Transactional update: Close PO + Update Stock
            const result = await prisma.$transaction(async (tx) => {
                // 1. Calculate Received Items
                // Logic: Iterate items payload { itemId: qtyReceived }
                
                // For simplified flow, we assume simple stock increment
                // For detailed inventory, we should create "InventoryMovement" or "BarangMasuk" record.
                // But user wants quick "Stok Bertambah".
                
                // Let's create proper Inventory Movements if possible, OR just direct update first.
                // Best practice: Create 'InventoryTransaction' if available. 
                // Checking schema... user has 'Barang', 'Stok'?
                // Let's check schema for 'Barang' relations.
                
                // Assuming simple update for now based on user "Simple Flow". 
                // We will iterate and update Barang.stok (if exists) or create movement.
                
                // 1. Update Items & Stock
                for (const item of po.items) {
                    // Type assertion to handle 'any' type from JSON body or strict record
                    const receivedQty = (items as Record<string, number>)[item.id] || 0
                    
                    if (receivedQty > 0) {
                        // Logic: Update BarangGudang & Create BarangMasuk matches
                        


                        // 1. Determine Target Gudang
                        // Try parsing notes first
                        let targetGudangId = ''
                        const shipToMatch = po.notes?.match(/\[Ship To Warehouse: (.*?) -/)
                        if (shipToMatch && shipToMatch[1]) {
                             const parsedId = shipToMatch[1].trim()
                             // Verify if this ID actually exists
                             const exists = await tx.gudang.findUnique({ where: { id: parsedId } })
                             if (exists) {
                                targetGudangId = parsedId
                             }
                        }
                        
                        // Fallback: Get first available Gudang if parse fails or invalid
                        if (!targetGudangId) {
                            // Try finding active one first
                            const firstGudang = await tx.gudang.findFirst({ where: { isActive: true }})
                            if (firstGudang) {
                                targetGudangId = firstGudang.id
                            } else {
                                // If no active warehouse, find ANY warehouse
                                const anyGudang = await tx.gudang.findFirst()
                                if (anyGudang) targetGudangId = anyGudang.id
                            }
                        }

                        if (!targetGudangId) {
                            throw new Error('Tidak ada Gudang yang tersedia untuk menyimpan barang. Harap buat Gudang terlebih dahulu.')
                        }



                        // Use InventoryRepository logic to ensure consistent behavior (Asset Creation, etc.)
                        const inventoryRepo = new InventoryRepository()
                        
                        // We need to call addStock within the transaction if possible.
                        // However, InventoryRepository.addStock creates its own transaction. 
                        // To avoid nested transaction issues if the repo doesn't support passing tx,
                        // we might need to replicate the logic OR update repo to accept tx.
                        // BUT, looking at repo code, it uses this.db.$transaction.
                        // Ideally we update repo to accept tx, but for now let's just use the logic directly here
                        // OR instantiate repo and trust it.
                        // Actually, since we are already in a transaction here (tx), calling another transaction (repo.addStock) might fail
                        // if the driver doesn't support nested transactions or if it waits.
                        
                        // BEST APPROACH: Replicate the 'addStock' logic here simply but WITH the Asset Creation part.
                        // OR better: Instantiate AssetRepository and call createMany if needed.
                        
                        // 2. Update BarangGudang (Stok)
                        const now = new Date()
                        await tx.barangGudang.upsert({
                            where: {
                                barangId_gudangId: {
                                    barangId: item.barangId,
                                    gudangId: targetGudangId
                                }
                            },
                            create: {
                                id: crypto.randomUUID(),
                                barangId: item.barangId,
                                gudangId: targetGudangId,
                                stok: receivedQty,
                                stokBaru: receivedQty,
                                stokBekas: 0,
                                stokRusak: 0,
                                updatedAt: now,
                                createdAt: now
                            },
                            update: {
                                stok: { increment: receivedQty },
                                stokBaru: { increment: receivedQty },
                                updatedAt: now
                            }
                        })

                        // 3. Create History (BarangMasuk)
                        const masuk = await tx.barangMasuk.create({
                            data: {
                                id: crypto.randomUUID(),
                                barangId: item.barangId,
                                gudangId: targetGudangId,
                                jumlah: receivedQty,
                                hargaBeliSatuan: item.unitPrice, // PASSING PRICE FROM PO
                                tanggal: now,
                                keterangan: `Penerimaan dari PO #${po.poNumber}`,
                                kondisi: 'BARU',
                                userId: session.id
                            },
                            include: {
                                barang: true,
                                gudang: true
                            }
                        })

                        // 4. AUTO-GENERATE ASSETS (The Missing Link)
                        if (masuk.barang && masuk.barang.jenis === 'ASET') {
                            let usefulLife = 48
                            if (masuk.barang.kategoriAset === 'KENDARAAN') usefulLife = 96
                            if (masuk.barang.kategoriAset === 'BANGUNAN') usefulLife = 240
                            if (masuk.barang.kategoriAset === 'FURNITURE') usefulLife = 96
                            
                            const assetsToCreate = []
                            const prefix = `AST-${masuk.barang.kode}`
                            const dateCode = new Date().toISOString().slice(2,7).replace('-','') // YYMM

                            // Generate base timestamp for this batch
                            const timestamp = Date.now().toString().slice(-6)
                            
                            for (let i = 0; i < receivedQty; i++) {
                                // Format: AST-{KodeBarang}-{YYMM}-{Timestamp}{Index}
                                // Example: AST-BRG123-2601-12345601
                                const uniqueSuffix = `${timestamp}${String(i + 1).padStart(2, '0')}`
                                
                                assetsToCreate.push({
                                    barangId: item.barangId,
                                    kodeAsset: `${prefix}-${dateCode}-${uniqueSuffix}`, 
                                    purchaseDate: now,
                                    purchasePrice: item.unitPrice, // Correct Price
                                    currentValue: item.unitPrice, // Correct Value
                                    usefulLife: usefulLife,
                                    residualValue: 0,
                                    status: 'ACTIVE' as const, 
                                    location: masuk.gudang?.nama || 'Gudang Utama',
                                    assignedTo: undefined
                                })
                            }
                            
                            if (assetsToCreate.length > 0) {
                                await tx.asset.createMany({
                                    data: assetsToCreate.map(a => ({
                                        id: crypto.randomUUID(),
                                        ...a
                                    }))
                                })
                            }
                        }
                    }
                } // End for loop items

                // 2. Update PO Status
                const newStatus = closePO ? 'RECEIVED' : 'PARTIAL'

                let updatedTotalAmount = po.totalAmount

                if (closePO) {
                    let recalculatedTotal = 0
                    const itemUpdates = []
                    
                    for (const item of po.items) {
                        const receivedQty = (items as Record<string, number>)[item.id] || 0
                        const newTotalPrice = receivedQty * item.unitPrice
                        recalculatedTotal += newTotalPrice

                        if (receivedQty !== item.quantity) {
                            itemUpdates.push(
                                tx.purchaseOrderItem.update({
                                    where: { id: item.id },
                                    data: { 
                                        quantity: receivedQty,
                                        totalPrice: newTotalPrice
                                    }
                                })
                            )
                        }
                    }
                    
                    if (itemUpdates.length > 0) {
                        await Promise.all(itemUpdates)
                    }
                    updatedTotalAmount = recalculatedTotal
                }
                
                const updatedPO = await tx.purchaseOrder.update({
                    where: { id },
                    data: {
                        status: newStatus as any, // Cast enum
                        receivedById: newStatus === 'RECEIVED' ? session.id : undefined,
                        totalAmount: updatedTotalAmount,
                        updatedAt: new Date()
                    }
                })

                return updatedPO
            })

            return NextResponse.json(result)
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    } catch (error: any) {
        console.error('Error updating PO:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
