"use client";

import { HiOutlineExclamationTriangle } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

type LoadErrorStateProps = {
  readonly title: string;
  readonly error: Error;
  readonly onRetry: () => void;
};

/** Pengganti empty state ketika data gagal dimuat, lengkap dengan tombol coba lagi. */
export function LoadErrorState({ title, error, onRetry }: LoadErrorStateProps) {
  return (
    <div role="alert">
      <EmptyState
        icon={<HiOutlineExclamationTriangle className="h-10 w-10" />}
        title={title}
        description={error.message}
        action={
          <Button variant="outline" size="sm" onClick={onRetry}>
            Coba lagi
          </Button>
        }
      />
    </div>
  );
}
