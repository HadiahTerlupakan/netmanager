import { randomUUID } from "crypto";
import { PermissionRepository } from "../repositories/PermissionRepository";

export type RequestedPermissionPair = {
  resource: string;
  action: string;
};

/** Build unique resource-action pairs from permission strings. */
function buildRequestedPairs(permissions: string[]): RequestedPermissionPair[] {
  return [...new Set(permissions)].map((permission) => {
    const [resource, action] = permission.split(":");
    return { resource, action };
  });
}

/** Resolve permission IDs and create missing permissions. */
export async function resolvePermissionIds(
  permissionRepository: PermissionRepository,
  permissions: string[],
): Promise<string[]> {
  const requestedPairs = buildRequestedPairs(permissions);
  if (requestedPairs.length === 0) {
    return [];
  }

  const existingPermissions =
    await permissionRepository.findManyByResourceActionPairs(requestedPairs);
  const missingPermissions = requestedPairs.filter((requested) => {
    return !existingPermissions.some((existing) => {
      return (
        existing.resource === requested.resource &&
        existing.action === requested.action
      );
    });
  });

  if (missingPermissions.length > 0) {
    await permissionRepository.createMany(
      missingPermissions.map((permission) => ({
        id: randomUUID(),
        resource: permission.resource,
        action: permission.action,
        name: `${permission.action.charAt(0).toUpperCase() + permission.action.slice(1)} ${permission.resource.charAt(0).toUpperCase() + permission.resource.slice(1)}`,
        description: `Izinkan ${permission.action} pada ${permission.resource}`,
        updatedAt: new Date(),
      })),
    );
  }

  const finalPermissions =
    await permissionRepository.findManyByResourceActionPairs(requestedPairs);
  return finalPermissions.map((permission) => permission.id);
}
