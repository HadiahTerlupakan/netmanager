import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import { prismaBilling } from "@/modules/database";
import {
  getMixRadiusService,
  matchesMixRadiusOwner,
} from "@/modules/integrations";
import type { MixRadiusCustomer } from "@/modules/integrations";

type RabInvestorProjectRecord = Prisma.RabInvestorGetPayload<{
  include: {
    rabProject: {
      include: {
        actualAchievements: true;
        site: { select: { name: true } };
      };
    };
  };
}>;

function getSecret(): Uint8Array {
  const raw = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!raw) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return new TextEncoder().encode(raw);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("investor_auth_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, getSecret());
    const investorId = payload.id as string;

    // Verify investor has access to this project
    const rabInvestor: RabInvestorProjectRecord | null =
      await prisma.rabInvestor.findUnique({
        where: {
          rabProjectId_investorId: {
            rabProjectId: id,
            investorId,
          },
        },
        include: {
          rabProject: {
            include: {
              actualAchievements: true,
              site: { select: { name: true } },
            },
          },
        },
      });

    if (!rabInvestor) {
      return NextResponse.json(
        { message: "Proyek tidak ditemukan" },
        { status: 404 },
      );
    }

    const p = rabInvestor.rabProject;

    let mixRadiusInvestorSite = null;
    if (p.mixRadiusInvestorSiteId) {
      mixRadiusInvestorSite =
        await prismaBilling.mixRadiusInvestorSite.findUnique({
          where: { id: p.mixRadiusInvestorSiteId },
        });
    }

    // Prepare dual billing logic for subscriber count & revenue
    let totalSubscribers = 0;
    let activeSubscribers = 0;
    let payingSubscribers = 0;

    let actualRevenueToDate = 0;

    // INTERNAL BILLING (Pelanggan PPP)
    if (p.siteId && !p.mixRadiusInvestorSiteId) {
      const customers = await prisma.pelanggan.findMany({
        where: { siteId: p.siteId },
        select: {
          status: true,
          jatuhTempo: true,
          hargaPaket: { select: { harga: true } },
        },
      });

      totalSubscribers = customers.length;
      activeSubscribers = customers.filter((c) => c.status === "AKTIF").length;

      const now = new Date();
      const payingCustomers = customers.filter(
        (c) => c.status === "AKTIF" && new Date(c.jatuhTempo) > now,
      );
      payingSubscribers = payingCustomers.length;

      // Estimasi Actual Revenue (Internal)
      actualRevenueToDate = payingCustomers.reduce(
        (acc, c) => acc + Number(c.hargaPaket?.harga || 0),
        0,
      );

      // MIXRADIUS API BILLING
    } else if (p.mixRadiusInvestorSiteId && mixRadiusInvestorSite) {
      const owners = mixRadiusInvestorSite.owners || [];
      if (owners.length > 0) {
        try {
          const service = getMixRadiusService();

          const response = await service.fetchCustomersPPP({
            start: 0,
            length: 10000,
            forceRefresh: false,
          });

          const customers: MixRadiusCustomer[] = response.data || [];

          const matchingCustomers = customers.filter((c) =>
            matchesMixRadiusOwner(c.owner_name, owners),
          );

          totalSubscribers = matchingCustomers.length;

          const now = new Date();
          const activeCustomers = matchingCustomers.filter((c) => {
            if (
              c.auth_status === "Active" ||
              c.auth_status === "Enabled-Users"
            ) {
              if (c.expired_on) {
                const expDate = new Date(c.expired_on);
                if (!isNaN(expDate.getTime()) && expDate < now) return false;
              }
              return true;
            }
            return false;
          });

          activeSubscribers = activeCustomers.length;
          payingSubscribers = activeCustomers.length; // Treat all active as paying

          actualRevenueToDate = activeCustomers.reduce(
            (acc, c) => acc + Number(c.total || 0),
            0,
          );
        } catch (e) {
          console.error("Failed to fetch from MixRadius:", e);
        }
      }
    }

    const projectData = {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      siteName: p.mixRadiusInvestorSiteId
        ? mixRadiusInvestorSite?.name
        : p.site?.name,
      billingSource: p.mixRadiusInvestorSiteId
        ? "MIXRADIUS"
        : p.siteId
          ? "INTERNAL"
          : "NONE",
      investmentAmount: rabInvestor.investmentAmount.toString(),
      profitSharePercent: rabInvestor.profitSharePercent,
      projectedRevenue: p.projectedRevenue.toString(),
      projectedOpex: p.projectedOpex.toString(),
      contingencyAmount: p.contingencyAmount.toString(),
      targetSubscribers: p.targetSubscribers,
      growthType: p.growthType,
      createdAt: p.createdAt,
      actualAchievements: p.actualAchievements.map((a) => ({
        id: a.id,
        month: a.month,
        year: a.year,
        achievedRevenue: a.actualRevenue.toString(),
        opex: a.actualOpex.toString(),
      })),
      estimatedCurrentRevenue: actualRevenueToDate.toString(),
      subscribers: {
        total: totalSubscribers,
        active: activeSubscribers,
        paying: payingSubscribers,
        paymentRatio:
          activeSubscribers > 0
            ? Math.round((payingSubscribers / activeSubscribers) * 100)
            : 0,
      },
    };

    return NextResponse.json({ project: projectData }, { status: 200 });
  } catch (error) {
    console.error("[INVESTOR_PROJECT_DETAIL] Error:", error);
    return NextResponse.json({ message: "Terjadi kesalahan" }, { status: 500 });
  }
}
