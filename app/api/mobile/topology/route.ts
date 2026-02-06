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

    const processedKmzFiles = activeKmzFiles.map((file: any) => {
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
      } catch (e) {
        return []
      }
    }

    // Process nodes to add usedSlots
    const nodesWithDetails = mappingNodes.map((node: any) => {
      const countData = edgeCounts.find((c: any) => c.source === node.nodeId)
      const usedSlots = countData ? countData._count.source : 0
      return {
        ...node,
        usedSlots
      }
    })

    // Index technical details (capacity, splitter, usedSlots) by ID
    const nodeDetailsMap = new Map()
    nodesWithDetails.forEach((node: any) => {
      nodeDetailsMap.set(node.nodeId, {
        splitter: node.splitter,
        capacity: node.capacity,
        usedSlots: node.usedSlots
      })
    })

    // Index edges for waypoints by source_target
    const edgeMap = new Map()
    mappingEdges.forEach((edge: any) => {
      edgeMap.set(`${edge.source}_${edge.target}`, parseWaypoints(edge.waypoints))
    })

    // Enrich OTBs with details
    const enrichedOtbs = otbs.map((otb: any) => {
      const details = nodeDetailsMap.get(otb.id) || { splitter: null, capacity: 0, usedSlots: 0 }
      return {
        ...otb,
        ...details
      }
    })

    // Enrich ODCs with details and waypoints
    const enrichedOdcs = odcs.map((odc: any) => {
      const details = nodeDetailsMap.get(odc.id) || { splitter: null, capacity: 0, usedSlots: 0 }
      let waypoints = []
      if (odc.otbCore?.otb?.id) {
        waypoints = edgeMap.get(`${odc.otbCore.otb.id}_${odc.id}`) || []
      }
      return {
        ...odc,
        ...details,
        otbCore: odc.otbCore ? { ...odc.otbCore, waypoints } : null
      }
    })

    // Enrich ODPs with details and waypoints
    const enrichedOdps = odps.map((odp: any) => {
      const details = nodeDetailsMap.get(odp.id) || { splitter: null, capacity: 0, usedSlots: 0 }
      let waypoints = []
      if (odp.odcOutput?.odc?.id) {
        waypoints = edgeMap.get(`${odp.odcOutput.odc.id}_${odp.id}`) || []
      }
      return {
        ...odp,
        ...details,
        odcOutput: odp.odcOutput ? { ...odp.odcOutput, waypoints } : null
      }
    })

    // Parse waypoints in the edges array as well
    const parsedEdges = mappingEdges.map((edge: any) => ({
      ...edge,
      waypoints: parseWaypoints(edge.waypoints)
    }))

    return NextResponse.json({
      otbs: enrichedOtbs,
      odcs: enrichedOdcs,
      odps: enrichedOdps,
      joinboxes,
      poles,
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
