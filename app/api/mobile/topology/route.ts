
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
      r2Settings
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
      getR2Settings()
    ])

    const processedKmzFiles = activeKmzFiles.map(file => {
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

    return NextResponse.json({
      otbs,
      odcs,
      odps,
      joinboxes,
      poles,
      pelanggans,
      kmzFiles: processedKmzFiles,
    }, {
      headers: {
        // Cache for 60 seconds, serve stale for up to 300 seconds while revalidating
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error: any) {
    console.error('Error fetching topology data:', error)
    return NextResponse.json({ error: 'Failed to fetch topology data' }, { status: 500 })
  }
}
