"use client";

import { useEffect, useState } from "react";
import { clientLogger } from "@/lib/client-logger";
import { useDebounce } from "@/hooks/useDebounce";
import { searchChatUsers } from "../_lib/chat-api";
import type { ChatUser } from "../_lib/chat-types";

const SEARCH_DEBOUNCE_MS = 300;

interface UserSearchOutcome {
  searchTerm: string;
  users: ChatUser[];
  errorMessage: string | null;
}

/**
 * Pencarian pegawai untuk chat baru. Hanya berjalan saat `isActive`
 * (modal terbuka), sehingga daftar awal dimuat ketika modal dibuka.
 */
export function useChatUserSearch(isActive: boolean) {
  const [searchTerm, setSearchTerm] = useState("");
  const [outcome, setOutcome] = useState<UserSearchOutcome | null>(null);
  const debouncedSearchTerm = useDebounce(searchTerm, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    if (!isActive) return undefined;
    let isStale = false;

    void searchChatUsers(debouncedSearchTerm).then((result) => {
      if (isStale) return;
      if (!result.isOk) {
        clientLogger.error("Error searching users:", result.message);
      }
      setOutcome((previous) => ({
        searchTerm: debouncedSearchTerm,
        // Saat gagal, daftar sebelumnya tetap tampil agar pilihan tidak hilang.
        users: result.isOk ? (result.data ?? []) : (previous?.users ?? []),
        errorMessage: result.isOk ? null : result.message,
      }));
    });

    return () => {
      isStale = true;
    };
  }, [isActive, debouncedSearchTerm]);

  return {
    searchTerm,
    setSearchTerm,
    users: outcome?.users ?? [],
    isSearching: outcome === null || outcome.searchTerm !== debouncedSearchTerm,
    searchError: outcome?.errorMessage ?? null,
  };
}
