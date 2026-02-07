import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { getR2Settings } from '@/lib/utils/r2-client'

export async function GET(request: Request) {
  // Verify mobile authentication
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    return NextResponse.json({ error: 'Token not provided' }, { status: 401 })
  }
  const payload = await verifyMobileToken(token)

  if (!payload) {
    return NextResponse.json({ error: 'Invalid Token' }, { status: 401 })
  }

  try {
    // Execute all database queries in parallel for better performance
    const [
      otbs,
      odcs,
      odps,
      joinboxes,
      poles,
      pelanggans,
      activeKmzFiles,
      r2Settings,
      mappingNodes,
      mappingEdges,
      edgeCounts
    ] = await Promise.all([
      // Ambil semua OTB dengan koordinat
      prisma.otb.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          name: true,
          location: true,
          latitude: true,
          longitude: true,
          notes: true,
          images: true,
        },
      }),

      // Ambil semua ODC dengan relasi ke OTB
      prisma.odc.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          name: true,
          location: true,
          latitude: true,
          longitude: true,
          notes: true,
          images: true,
          attenuationIn: true,
          attenuationOut: true,
          inputCoreColor: true,
          otbCore: {
            select: {
              coreColor: true,
              tubeColor: true,
              otb: {
                select: {
                  id: true,
                  name: true,
                  latitude: true,
                  longitude: true,
                },
              },
            },
          },
        },
      }),

      // Ambil semua ODP dengan relasi ke ODC
      prisma.odp.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          name: true,
          location: true,
          latitude: true,
          longitude: true,
          notes: true,
          images: true,
          attenuationIn: true,
          attenuationOut: true,
          inputCoreColor: true,
          odcOutput: {
            select: {
              coreColor: true,
              tubeColor: true,
              odc: {
                select: {
                  id: true,
                  name: true,
                  latitude: true,
                  longitude: true,
                },
              },
            },
          },
          _count: {
            select: { odpOutput: true }
          },
          site: {
            select: { name: true }
          }
        },
      }),

      // Ambil semua Joinbox dengan koordinat
      prisma.joinbox.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          name: true,
          location: true,
          latitude: true,
          longitude: true,
          notes: true,
          images: true,
        },
      }),

      // Ambil semua Pole dengan koordinat
      prisma.pole.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          name: true,
          location: true,
          latitude: true,
          longitude: true,
          notes: true,
          images: true,
          cableSlack: true,
        },
      }),

      // Ambil semua Pelanggan yang memiliki koordinat dan ODP
      prisma.pelanggan.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
          odpId: { not: null },
        },
        select: {
          id: true,
          idPelanggan: true,
          nama: true,
          latitude: true,
          longitude: true,
          alamat: true,
          status: true,
          odpId: true,
          odp: {
            select: {
              id: true,
              name: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      }),

      // Ambil semua KMZ files yang aktif
      prisma.kmzFile.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          kmlPath: true,
          lineColor: true,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),

      // Get R2 Settings to resolve URLs
      getR2Settings(),

      // Get Mapping Nodes (Admin Version)
      prisma.mappingNode.findMany(),

      // Get Mapping Edges (Admin Version with waypoints)
      prisma.mappingEdge.findMany(),

      // Get Edge Counts for Capacity Calculation
      prisma.mappingEdge.groupBy({
        by: ['source'],
        _count: { source: true }
      })
    ])

    const processedKmzFiles = activeKmzFiles.map((file) => {
      // If path is already a full URL, return as is
      if (file.kmlPath.startsWith('http')) {
        return file
      }

      // If R2 is enabled, construct R2 URL
      if (r2Settings?.enabled) {
        // Remove leading slash if present
        const cleanPath = file.kmlPath.startsWith('/') ? file.kmlPath.substring(1) : file.kmlPath

        // Use configured public URL or default R2 dev URL
        const baseUrl = r2Settings.publicUrl
          ? r2Settings.publicUrl.replace(/\/$/, '')
          : `https://${r2Settings.bucketName}.${r2Settings.accountId}.r2.cloudflarestorage.com`

        return {
          ...file,
          kmlPath: `${baseUrl}/${cleanPath}`
        }
      }

      // If local (R2 disabled), return relative path (frontend handles base URL)
      return file
    })

    // Helper to parse waypoints safely
    const parseWaypoints = (wpString: string | null) => {
      if (!wpString) return []
      try {
        return JSON.parse(wpString)
      } catch (_) {
        return []
      }
    }

    // Index parent nodes by edge target
    const parentMap = new Map()
    mappingEdges.forEach((edge) => {
      // Find the source node (parent)
      const parentNode = mappingNodes.find((n) => n.nodeId === edge.source)
      if (parentNode) {
        // Store parent details for the target node
        parentMap.set(edge.target, {
          id: parentNode.nodeId,
          name: parentNode.name,
          type: parentNode.type
        })
      }
    })

    // Process nodes to add usedSlots and resolve photo URL
    const nodesWithDetails = mappingNodes.map((node) => {
      const countData = edgeCounts.find((c) => c.source === node.nodeId)
      const usedSlots = countData ? countData._count.source : 0

      let photoUrl = node.photo
      if (photoUrl && !photoUrl.startsWith('http')) {
        if (r2Settings?.enabled) {
          const cleanPath = photoUrl.startsWith('/') ? photoUrl.substring(1) : photoUrl
          const baseUrl = r2Settings.publicUrl
            ? r2Settings.publicUrl.replace(/\/$/, '')
            : `https://${r2Settings.bucketName}.${r2Settings.accountId}.r2.cloudflarestorage.com`
          photoUrl = `${baseUrl}/${cleanPath}`
        }
      }

      return {
        ...node,
        usedSlots,
        photo: photoUrl,
        parent: parentMap.get(node.nodeId)
      }
    })

    // Index technical details (capacity, splitter, usedSlots, photo, inputCoreColor) by ID
    const nodeDetailsMap = new Map()
    nodesWithDetails.forEach((node) => {
      const parent = parentMap.get(node.nodeId)
      nodeDetailsMap.set(node.nodeId, {
        splitter: node.splitter,
        capacity: node.capacity,
        usedSlots: node.usedSlots,
        photo: node.photo,
        inputCoreColor: node.inputCoreColor,
        attenuationInput: node.attenuationIn,
        attenuationOutput: node.attenuationOut,
        parent: parent
      })
    })

    // Index edges for waypoints by source_target
    const edgeMap = new Map()
    mappingEdges.forEach((edge) => {
      edgeMap.set(`${edge.source}_${edge.target}`, parseWaypoints(edge.waypoints))
    })

    // Enrich OTBs with details
    const enrichedOtbs = otbs.map((otb) => {
      const details = nodeDetailsMap.get(otb.id) || { splitter: null, capacity: 0, usedSlots: 0 }
      return {
        ...otb,
        ...details
      }
    })

    // Enrich ODCs with details and waypoints
    const enrichedOdcs = odcs.map((odc) => {
      const details = nodeDetailsMap.get(odc.id) || { splitter: null, capacity: 0, usedSlots: 0 }
      let waypoints = []
      if (odc.otbCore?.otb?.id) {
        waypoints = edgeMap.get(`${odc.otbCore.otb.id}_${odc.id}`) || []
      }

      // Fallback logic for parent and attenuation
      const parent = details.parent || (odc.otbCore?.otb ? {
        id: odc.otbCore.otb.id,
        name: odc.otbCore.otb.name,
        type: 'otb'
      } : undefined);

      return {
        ...odc,
        ...details,
        attenuationInput: details.attenuationInput ?? odc.attenuationIn,
        attenuationOutput: details.attenuationOutput ?? odc.attenuationOut,
        inputCoreColor: details.inputCoreColor ?? odc.inputCoreColor,
        parent,
        otbCore: odc.otbCore ? { ...odc.otbCore, waypoints } : null
      }
    })

    // Enrich ODPs with details and waypoints
    const enrichedOdps = odps.map((odp) => {
      const details = nodeDetailsMap.get(odp.id) || { splitter: null, capacity: 0, usedSlots: 0 }
      let waypoints: unknown[] = []
      if (odp.odcOutput?.odc?.id) {
        waypoints = edgeMap.get(`${odp.odcOutput.odc.id}_${odp.id}`) || []
      }

      // Fallback logic for parent and attenuation
      const parent = details.parent || (odp.odcOutput?.odc ? {
        id: odp.odcOutput.odc.id,
        name: odp.odcOutput.odc.name,
        type: 'odc'
      } : undefined);

      return {
        ...odp,
        ...details,
        siteName: odp.site?.name,
        odpOutputCount: odp._count?.odpOutput,
        attenuationInput: details.attenuationInput ?? odp.attenuationIn,
        attenuationOutput: details.attenuationOutput ?? odp.attenuationOut,
        inputCoreColor: details.inputCoreColor ?? odp.inputCoreColor,
        parent,
        odcOutput: odp.odcOutput ? { ...odp.odcOutput, waypoints } : null
      }
    })

    // Enrich Joinboxes with details
    const enrichedJoinboxes = joinboxes.map((jb) => {
      const details = nodeDetailsMap.get(jb.id) || { splitter: null, capacity: 0, usedSlots: 0 }
      return {
        ...jb,
        ...details
      }
    })

    // Enrich Poles with details
    const enrichedPoles = poles.map((pole) => {
      const details = nodeDetailsMap.get(pole.id) || { splitter: null, capacity: 0, usedSlots: 0 }
      return {
        ...pole,
        ...details
      }
    })

    // Parse waypoints in the edges array as well
    const parsedEdges = mappingEdges.map((edge) => ({
      ...edge,
      waypoints: parseWaypoints(edge.waypoints)
    }))

    return NextResponse.json({
      otbs: enrichedOtbs,
      odcs: enrichedOdcs,
      odps: enrichedOdps,
      joinboxes: enrichedJoinboxes,
      poles: enrichedPoles,
      pelanggans,
      kmzFiles: processedKmzFiles,
      nodes: nodesWithDetails,
      edges: parsedEdges,
    }, {
      headers: {
        // Cache for 60 seconds, serve stale for up to 300 seconds while revalidating
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error: unknown) {
    console.error('Error fetching topology data:', error)
    return NextResponse.json({ error: 'Failed to fetch topology data' }, { status: 500 })
  }
}
