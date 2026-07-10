"use client";

import { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";
import { USER_LIST_MESSAGES } from "./constants";
import { deleteUser, forceLogoutUser } from "./userApi";

interface UseUserMutationsOptions {
  onSuccess?: () => void | Promise<unknown>;
}

interface UseUserMutationsResult {
  deleteUserId: string | null;
  setDeleteUserId: (id: string | null) => void;
  deleting: boolean;
  handleDelete: (userId: string) => Promise<void>;
  forceLogoutUserId: string | null;
  setForceLogoutUserId: (id: string | null) => void;
  forcingLogout: boolean;
  handleForceLogout: (userId: string) => Promise<void>;
}

export function useUserMutations({
  onSuccess,
}: UseUserMutationsOptions = {}): UseUserMutationsResult {
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [forceLogoutUserId, setForceLogoutUserId] = useState<string | null>(
    null,
  );
  const [forcingLogout, setForcingLogout] = useState(false);

  const handleDelete = useCallback(
    async (userId: string) => {
      setDeleting(true);
      try {
        await deleteUser(userId);
        setDeleteUserId(null);
        toast.success(USER_LIST_MESSAGES.SUCCESS.DELETE);
        await onSuccess?.();
      } catch (error) {
        clientLogger.error("Error deleting user:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : USER_LIST_MESSAGES.ERROR.DELETE_FAILED,
        );
      } finally {
        setDeleting(false);
      }
    },
    [onSuccess],
  );

  const handleForceLogout = useCallback(async (userId: string) => {
    setForcingLogout(true);
    try {
      const message = await forceLogoutUser(userId);
      toast.success(message);
      setForceLogoutUserId(null);
    } catch (error) {
      clientLogger.error("Error force logout user:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : USER_LIST_MESSAGES.ERROR.FORCE_LOGOUT_FAILED,
      );
    } finally {
      setForcingLogout(false);
    }
  }, []);

  return {
    deleteUserId,
    setDeleteUserId,
    deleting,
    handleDelete,
    forceLogoutUserId,
    setForceLogoutUserId,
    forcingLogout,
    handleForceLogout,
  };
}
