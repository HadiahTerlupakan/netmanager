"use client";

import { useState, useCallback } from "react";

interface UseUserSelectionResult {
  selectedUserIds: string[];
  toggleUserSelection: (userId: string) => void;
  clearSelection: () => void;
}

export function useUserSelection(): UseUserSelectionResult {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedUserIds([]);
  }, []);

  return { selectedUserIds, toggleUserSelection, clearSelection };
}
