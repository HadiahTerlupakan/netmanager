import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import type { Prisma, Status } from "@prisma/client";
import { prisma } from "@/modules/database";
import { prismaBilling } from "@/modules/database";
import {
  getMixRadiusService,
  matchesMixRadiusOwner,
} from "@/modules/integrations";
import type { MixRadiusCustomer } from "@/modules/integrations";

type RabInvestorDashboardRecord = Prisma.RabInvestorGetPayload<{
  include: {
    rabProject: {
      include: {
        actualAchievements: true;
        items: true;
        site: { select: { name: true } };
      };
    };
  };
}>;

type InternalCustomer = {
  siteId: string | null;
  status: Status;
  idPelanggan: string;
  jatuhTempo: Date;
  hargaPaket: {
    harga: Prisma.Decimal | number | bigint | string;
  } | null;
};

function getSecret(): Uint8Array {
  const raw = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!raw) throw new Error("NEXTAUTH_SECRET environment variable is required");
  return new TextEncoder().encode(raw);
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("investor_auth_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, getSecret());
    const investorId = payload.id as string;

    const rabInvestors: RabInvestorDashboardRecord[] =
      await prisma.rabInvestor.findMany({
        where: { investorId },
        include: {
          rabProject: {
            include: {
              actualAchievements: true,
              items: true,
              site: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

    // Calculate metrics
    let totalInvestment = BigInt(0);
    let totalProjectedRevenue = BigInt(0);
    let totalActualRevenue = BigInt(0);
    const activeProjectsCount = rabInvestors.length;

    // Compile site IDs to measure subscriber growth accurately (Internal APP Site)
    const siteIds = [
      ...new Set(
        rabInvestors
          .filter(
            (ri) =>
              ri.rabProject.siteId && !ri.rabProject.mixRadiusInvestorSiteId,
          )
          .map((ri) => ri.rabProject.siteId)
          .filter((id): id is string => id !== null),
      ),
    ];

    // Fetch MixRadiusInvestorSite details from billing DB
    const investorSiteIds = [
      ...new Set(
        rabInvestors
          .map((ri) => ri.rabProject.mixRadiusInvestorSiteId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const investorSites =
      investorSiteIds.length > 0
        ? await prismaBilling.mixRadiusInvestorSite.findMany({
            where: { id: { in: investorSiteIds } },
          })
        : [];
    const investorSiteMap = new Map(investorSites.map((is) => [is.id, is]));

    // Compile MixRadius owners
    const mixRadiusOwners = [
      ...new Set(
        rabInvestors
          .filter((ri) => {
            const investorSiteId = ri.rabProject.mixRadiusInvestorSiteId;
            return Boolean(
              investorSiteId && investorSiteMap.has(investorSiteId),
            );
          })
          .flatMap((ri) => {
            const investorSiteId = ri.rabProject.mixRadiusInvestorSiteId;
            return investorSiteId
              ? investorSiteMap.get(investorSiteId)?.owners || []
              : [];
          }),
      ),
    ];

    let totalSubscribers = 0;
    let activeSubscribers = 0;
    let payingSubscribers = 0;

    let internalCustomers: InternalCustomer[] = [];

    // INTERNAL BILLING
    if (siteIds.length > 0) {
      internalCustomers = await prisma.pelanggan.findMany({
        where: { siteId: { in: siteIds } },
        select: {
          siteId: true,
          status: true,
          idPelanggan: true,
          jatuhTempo: true,
          hargaPaket: { select: { harga: true } },
        },
      });

      totalSubscribers += internalCustomers.length;
      activeSubscribers += internalCustomers.filter(
        (c) => c.status === "AKTIF",
      ).length;

      const now = new Date();
      payingSubscribers += internalCustomers.filter(
        (c) => c.status === "AKTIF" && c.jatuhTempo > now,
      ).length;
    }

    let mixRadiusCustomers: MixRadiusCustomer[] = [];
    // MIXRADIUS BILLING
    if (mixRadiusOwners.length > 0) {
      try {
        const service = getMixRadiusService();

        // Fetch all customers (we don't pass owner map initially because the service filters based on active configs, we map everything matching the list)
        const response = await service.fetchCustomersPPP({
          start: 0,
          length: 10000,
          forceRefresh: false,
        });

        mixRadiusCustomers = response.data || [];

        // Filter by our specific mixRadiusOwners mapping in rabProject
        const matchingCustomers = mixRadiusCustomers.filter((c) =>
          matchesMixRadiusOwner(c.owner_name, mixRadiusOwners as string[]),
        );

        totalSubscribers += matchingCustomers.length;

        // Identify active based on their auth_status / expiration
        const now = new Date();
        const activeCustomers = matchingCustomers.filter((c) => {
          // Filter based on MixRadiusService logic for "Active" vs "Isolir"
          // Assume 'Enabled-Users' and not expired is Active
          if (c.auth_status === "Active" || c.auth_status === "Enabled-Users") {
            if (c.expired_on) {
              const expDate = new Date(c.expired_on as string);
              if (!isNaN(expDate.getTime()) && expDate < now) return false; // Expired
            }
            return true;
          }
          return false;
        });

        activeSubscribers += activeCustomers.length;
        payingSubscribers += activeCustomers.length; // Treat all active as paying
      } catch (e) {
        console.error("Error fetching MixRadius metrics:", e);
      }
    }

    for (const ri of rabInvestors) {
      totalInvestment += BigInt(ri.investmentAmount.toString());

      const netProjected = Math.max(
        0,
        Number(ri.rabProject.projectedRevenue) -
          Number(ri.rabProject.projectedOpex) -
          Number(ri.rabProject.contingencyAmount),
      );
      const projRev = netProjected * (Number(ri.profitSharePercent) / 100);
      totalProjectedRevenue += BigInt(Math.floor(projRev));

      // Estimasi pendapatan aktif real-time berjalan untuk bulan ini (Dual Biling)
      let currentActualRevenue = 0;
      const now = new Date();

      if (ri.rabProject.siteId && !ri.rabProject.mixRadiusInvestorSiteId) {
        // Internal Billing
        const payingInternal = internalCustomers.filter(
          (c) =>
            c.siteId === ri.rabProject.siteId &&
            c.status === "AKTIF" &&
            new Date(c.jatuhTempo) > now,
        );
        currentActualRevenue = payingInternal.reduce(
          (acc, c) => acc + Number(c.hargaPaket?.harga || 0),
          0,
        );
      } else if (
        ri.rabProject.mixRadiusInvestorSiteId &&
        investorSiteMap.has(ri.rabProject.mixRadiusInvestorSiteId)
      ) {
        // MixRadius API Billing
        const owners =
          investorSiteMap.get(ri.rabProject.mixRadiusInvestorSiteId)?.owners ||
          [];
        const activeMixRadius = mixRadiusCustomers.filter((c) => {
          const isOwnerMatch = matchesMixRadiusOwner(
            c.owner_name,
            owners as string[],
          );
          if (!isOwnerMatch) return false;

          if (c.auth_status === "Active" || c.auth_status === "Enabled-Users") {
            if (c.expired_on) {
              const expDate = new Date(c.expired_on as string);
              if (!isNaN(expDate.getTime()) && expDate < now) return false;
            }
            return true;
          }
          return false;
        });
        currentActualRevenue = activeMixRadius.reduce(
          (acc, c) => acc + Number(c.total || 0),
          0,
        );
      }

      // Tambahkan porsi profit investor dari pendapatan aktif berjalan ini
      const netCurrentActual = Math.max(
        0,
        currentActualRevenue - Number(ri.rabProject.projectedOpex || 0),
      );
      const actCurrentRev =
        netCurrentActual * (Number(ri.profitSharePercent) / 100);
      totalActualRevenue += BigInt(Math.floor(actCurrentRev));

      // Tambahkan juga riwayat actualAchievements sebelumnya (jika ada)
      for (const ach of ri.rabProject.actualAchievements) {
        const netActual = Math.max(
          0,
          Number(ach.actualRevenue) - Number(ach.actualOpex || 0),
        );
        const actRev = netActual * (Number(ri.profitSharePercent) / 100);
        totalActualRevenue += BigInt(Math.floor(actRev));
      }
    }

    const projectsSummary = rabInvestors.map((ri) => ({
      id: ri.rabProject.id,
      name: ri.rabProject.name,
      status: ri.rabProject.status,
      siteName: ri.rabProject.site?.name || "Lokasi Global",
    }));

    return NextResponse.json(
      {
        totalInvestment: totalInvestment.toString(),
        totalProjectedRevenue: totalProjectedRevenue.toString(),
        totalActualRevenue: totalActualRevenue.toString(),
        activeProjectsCount,
        projects: projectsSummary,
        subscribers: {
          total: totalSubscribers,
          active: activeSubscribers,
          paying: payingSubscribers,
          paymentRatio:
            activeSubscribers > 0
              ? Math.round((payingSubscribers / activeSubscribers) * 100)
              : 0,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[INVESTOR_DASHBOARD] Error:", error);
    return NextResponse.json({ message: "Terjadi kesalahan" }, { status: 500 });
  }
}
