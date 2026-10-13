/** RAB Revision types for service layer - no Prisma dependency */

export type UserSelect = {
  id: true;
  name: true;
  email: true;
  role: { select: { name: true } };
};

export type RabRevisionInclude = {
  items: { orderBy: { sortOrder: "asc" } };
  approvals: {
    include: { user: { select: UserSelect } };
    orderBy: { createdAt: "asc" };
  };
};

export type RabRevisionOrderByWithRelationInput = {
  revisionNumber: "asc" | "desc";
};
