import { getUserPermissions } from "@/lib/auth";

type MixRadiusAccessOptions = {
  userId: string;
  isSuperAdmin: boolean;
  requiredPermissions: string[];
};

function hasWildcardPermission(permissions: string[]) {
  return permissions.includes("*");
}

function hasRequiredPermission(params: {
  permissions: string[];
  requiredPermissions: string[];
}) {
  return params.requiredPermissions.some((permission) =>
    params.permissions.includes(permission),
  );
}

export class MixRadiusAccessService {
  /** Check whether a user can access MixRadius resources. */
  async canAccess(options: MixRadiusAccessOptions) {
    if (options.isSuperAdmin) {
      return true;
    }

    const permissions = await getUserPermissions(options.userId);
    if (hasWildcardPermission(permissions)) {
      return true;
    }

    return hasRequiredPermission({
      permissions,
      requiredPermissions: options.requiredPermissions,
    });
  }
}

let mixRadiusAccessServiceInstance: MixRadiusAccessService | null = null;

/** Get singleton MixRadius access service. */
export function getMixRadiusAccessService() {
  if (!mixRadiusAccessServiceInstance) {
    mixRadiusAccessServiceInstance = new MixRadiusAccessService();
  }

  return mixRadiusAccessServiceInstance;
}
