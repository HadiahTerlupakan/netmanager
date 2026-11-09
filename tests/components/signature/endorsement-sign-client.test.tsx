import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import EndorsementSignClient from "@/app/p/[token]/EndorsementSignClient";

describe("EndorsementSignClient dengan SignaturePad bersama", () => {
  it("tetap menampilkan kotak tanda tangan dan tombol Ulangi bertipe button", () => {
    const markup = renderToStaticMarkup(
      <EndorsementSignClient
        token="t"
        number="END-001"
        title="Surat"
        description={null}
        status="SENT"
        expiresAt={null}
        signerName="Andi"
        signerRole={null}
        signerStatus="PENDING"
        signedCount={0}
        signerCount={1}
      />,
    );

    expect(markup).toContain("<canvas");
    expect(markup).toContain("Goreskan tanda tangan Anda di kotak di atas.");
    expect(markup).toMatch(/<button[^>]*type="button"[^>]*>Ulangi<\/button>/);
  });
});
