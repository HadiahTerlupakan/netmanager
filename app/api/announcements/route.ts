import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/modules/database";
import { requireAuth } from "@/lib/auth-helpers";
import type { TargetAudience } from "@prisma/client";
import { firebaseRealtimeService } from "@/lib/realtime";
import { logger } from "@/lib/logger";

function buildAnnouncementPayload(announcement: {
  id: string;
  title: string;
  content: string;
  target: TargetAudience;
  isPinned: boolean;
  createdAt: Date;
}) {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    target: announcement.target,
    isPinned: announcement.isPinned,
    createdAt: announcement.createdAt.toISOString(),
  };
}

async function publishToUserScopes(
  userIds: string[],
  payload: ReturnType<typeof buildAnnouncementPayload>,
) {
  await Promise.all(
    userIds.map((id) =>
      firebaseRealtimeService.publish({
        type: "announcement.new",
        scope: { kind: "user", id },
        payload,
      }),
    ),
  );
}

async function publishAnnouncementRealtime(announcement: {
  id: string;
  title: string;
  content: string;
  target: TargetAudience;
  isPinned: boolean;
  createdAt: Date;
}) {
  const payload = buildAnnouncementPayload(announcement);

  if (announcement.target === "ADMIN") {
    await firebaseRealtimeService.publish({
      type: "announcement.new",
      scope: { kind: "admin", id: "announcements" },
      payload,
    });
    return;
  }

  if (announcement.target === "EMPLOYEE") {
    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: { in: ["EMPLOYEE", "TEKNISI"] } },
      },
      select: { id: true },
    });

    await publishToUserScopes(
      employees.map((employee) => employee.id),
      payload,
    );
    return;
  }

  if (announcement.target === "CUSTOMER") {
    const customers = await prisma.pelanggan.findMany({
      where: { status: "AKTIF" },
      select: { id: true },
    });

    await publishToUserScopes(
      customers.map((customer) => customer.id),
      payload,
    );
    return;
  }

  const [employees, customers] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: { in: ["EMPLOYEE", "TEKNISI"] } },
      },
      select: { id: true },
    }),
    prisma.pelanggan.findMany({
      where: { status: "AKTIF" },
      select: { id: true },
    }),
  ]);

  await firebaseRealtimeService.publish({
    type: "announcement.new",
    scope: { kind: "admin", id: "announcements" },
    payload,
  });

  await publishToUserScopes(
    [
      ...employees.map((employee) => employee.id),
      ...customers.map((customer) => customer.id),
    ],
    payload,
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) {
      return session;
    }
    const { searchParams } = new URL(request.url);

    const target = searchParams.get("target") as TargetAudience | undefined;
    const activeOnly = searchParams.get("active") === "true";
    const portal = searchParams.get("portal");

    let where: {
      target?: TargetAudience | { in: TargetAudience[] };
      isActive?: boolean;
      startDate?: { lte: Date };
      OR?: Array<{ endDate: null } | { endDate: { gte: Date } }>;
    } = {};

    if (portal === "customer") {
      where = {
        target: { in: ["ALL", "CUSTOMER"] },
        isActive: true,
        startDate: { lte: new Date() },
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      };
    } else if (portal === "employee") {
      where = {
        target: { in: ["ALL", "EMPLOYEE"] },
        isActive: true,
        startDate: { lte: new Date() },
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      };
    } else if (portal === "admin") {
      where = {
        target: { in: ["ALL", "ADMIN"] },
        isActive: true,
        startDate: { lte: new Date() },
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      };
    } else {
      if (target) where.target = target;
      if (activeOnly) where.isActive = true;
    }

    const announcements = await prisma.announcement.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: { reads: true },
        },
      },
    });

    return NextResponse.json(announcements);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const body = await request.json();
    const { title, content, target, isActive, isPinned, startDate, endDate } =
      body;

    const announcement = await prisma.announcement.create({
      data: {
        id: crypto.randomUUID(),
        title,
        content,
        target,
        isActive: isActive ?? true,
        isPinned: isPinned ?? false,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        createdBy: session.user.id,
        updatedAt: new Date(),
      },
    });

    await logger.logActivity({
      action: "CREATE",
      subject: "Announcement",
      details: {
        id: announcement.id,
        title: announcement.title,
        target: announcement.target,
      },
      userId: session.user.id,
    });

    if (isActive !== false) {
      void publishAnnouncementRealtime(announcement).catch((realtimeError) => {
        logger.error(
          "[Announcements] Failed to publish realtime update",
          realtimeError as Error,
          {
            announcementId: announcement.id,
          },
        );
      });
    }

    if (isActive !== false && target !== "CUSTOMER") {
      try {
        const userFilter: {
          pushToken: { not: null };
          isActive: boolean;
          role?: { name: string | { in: string[] } };
        } = {
          pushToken: { not: null },
          isActive: true,
        };

        if (target === "EMPLOYEE") {
          userFilter.role = { name: { in: ["EMPLOYEE", "TEKNISI"] } };
        } else if (target === "ADMIN") {
          userFilter.role = { name: { in: ["ADMIN", "SUPER_ADMIN"] } };
        }

        const dbUserFilter = {
          isActive: true,
          ...(userFilter.role ? { role: userFilter.role } : {}),
        };

        const users = await prisma.user.findMany({
          where: userFilter,
          select: { id: true, pushToken: true },
        });

        const now = new Date();
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );

        const usersOnLeave = await prisma.leaveRequest.findMany({
          where: {
            status: "APPROVED",
            startDate: { lte: now },
            endDate: { gte: startOfToday },
            userId: { in: users.map((u: { id: string }) => u.id) },
          },
          select: { userId: true },
        });

        const userIdsOnLeave = new Set(
          usersOnLeave.map((u: { userId: string }) => u.userId),
        );

        const tokens = users
          .filter((u: { id: string }) => !userIdsOnLeave.has(u.id))
          .map((u: { pushToken: string | null }) => u.pushToken)
          .filter((t: string | null): t is string => t !== null && t !== "");

        if (tokens.length > 0) {
          const { sendExpoPushNotifications } = await import("@/lib/expo");
          await sendExpoPushNotifications(
            tokens,
            announcement.title,
            announcement.content.substring(0, 100) +
              (announcement.content.length > 100 ? "..." : ""),
            { announcementId: announcement.id, url: "/announcement" },
          );
        }

        const allTargetedUsers = await prisma.user.findMany({
          where: dbUserFilter,
          select: { id: true },
        });

        if (allTargetedUsers.length > 0) {
          const notificationData = allTargetedUsers.map(
            (user: { id: string }) => ({
              id: crypto.randomUUID(),
              type: "ANNOUNCEMENT",
              title: announcement.title,
              message:
                announcement.content.substring(0, 100) +
                (announcement.content.length > 100 ? "..." : ""),
              userId: user.id,
              sourceType: "ANNOUNCEMENT",
              sourceId: announcement.id,
              isRead: false,
              priority: "NORMAL",
              createdAt: new Date(),
            }),
          );

          await prisma.notifications.createMany({
            data: notificationData,
          });
        }
      } catch (pushError) {
        console.error("[PUSH] Failed to send push notifications:", pushError);
      }
    }

    return NextResponse.json(announcement);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
