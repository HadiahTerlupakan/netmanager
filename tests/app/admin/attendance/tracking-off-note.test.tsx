import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TrackingOffNote } from "@/app/admin/attendance/TrackingOffNote";

describe("TrackingOffNote", () => {
  it("shows hours and minutes of tracking off", () => {
    expect(renderToStaticMarkup(<TrackingOffNote minutes={130} />)).toContain(
      "Tracking mati 2 jam 10 mnt",
    );
  });

  it("shows nothing when tracking never went off or was not judged", () => {
    expect(renderToStaticMarkup(<TrackingOffNote minutes={0} />)).toBe("");
    expect(renderToStaticMarkup(<TrackingOffNote minutes={null} />)).toBe("");
  });
});
