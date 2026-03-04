import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const canvasing = await prisma.canvasing.findMany({
    take: 5,
    include: {
      user: {
        select: {
          name: true,
          email: true
        }
      }
    }
  });

  return NextResponse.json({ 
    data: canvasing
  });
}
