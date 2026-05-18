import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import RABRevisionForm from "@/app/admin/integrations/mixradius/expenses/RABRevisionForm";

describe("RABRevisionForm", () => {
  it("requires a revision reason before submission", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0, gcTime: Infinity },
        mutations: { retry: false },
      },
    });

    const html = renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(RABRevisionForm, {
          open: true,
          projectId: "rab-1",
          projectName: "Project Fiber",
          onClose: vi.fn(),
          onSaved: vi.fn(),
        }),
      ),
    );

    expect(html).toContain("Simpan Draft");
    expect(html).toContain("Alasan Revisi");
    expect(html).toContain("required");
  });
});
