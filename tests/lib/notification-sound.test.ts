// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOTIFICATION_SOUND_SRC,
  isCustomerNotificationSoundEnabled,
  playCustomerNotificationSound,
  setCustomerNotificationSoundEnabled,
} from "@/lib/notification-sound";

const play = vi.fn<() => Promise<void>>();
const AudioMock = vi.fn(function (this: { play: typeof play }) {
  this.play = play;
});

describe("notification sound", () => {
  beforeEach(() => {
    localStorage.clear();
    play.mockReset().mockResolvedValue(undefined);
    AudioMock.mockClear();
    vi.stubGlobal("Audio", AudioMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("points at a file that is actually served from public/", () => {
    expect(
      existsSync(join(process.cwd(), "public", NOTIFICATION_SOUND_SRC)),
    ).toBe(true);
  });

  it("plays for customers unless they turned it off", () => {
    expect(isCustomerNotificationSoundEnabled()).toBe(true);

    playCustomerNotificationSound();
    expect(AudioMock).toHaveBeenCalledWith(NOTIFICATION_SOUND_SRC);
    expect(play).toHaveBeenCalledTimes(1);

    setCustomerNotificationSoundEnabled(false);
    expect(isCustomerNotificationSoundEnabled()).toBe(false);
    playCustomerNotificationSound();
    expect(play).toHaveBeenCalledTimes(1);

    setCustomerNotificationSoundEnabled(true);
    playCustomerNotificationSound();
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("swallows the autoplay rejection a browser gives before any interaction", async () => {
    play.mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"));

    expect(() => playCustomerNotificationSound()).not.toThrow();
    await Promise.resolve();
  });
});
