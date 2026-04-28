import { describe, expect, it } from "vitest";
import { shouldNotifyForChatMessage } from "@/modules/chat";

describe("shouldNotifyForChatMessage", () => {
  it("suppresses alerts for own messages", () => {
    expect(shouldNotifyForChatMessage(true, "conv-1", "conv-2")).toBe(false);
  });

  it("suppresses alerts for the currently open conversation", () => {
    expect(shouldNotifyForChatMessage(false, "conv-1", "conv-1")).toBe(false);
  });

  it("allows alerts for other conversations", () => {
    expect(shouldNotifyForChatMessage(false, "conv-1", "conv-2")).toBe(true);
    expect(shouldNotifyForChatMessage(false, null, "conv-2")).toBe(true);
  });
});
