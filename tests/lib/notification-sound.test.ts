// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOTIFICATION_QUIET_PERIOD_MS,
  NOTIFICATION_SOUND_SRC,
  NOTIFICATION_SOUND_THROTTLE_MS,
} from "@/lib/notification-sound";

type SoundModule = typeof import("@/lib/notification-sound");

const NOW = Date.parse("2026-11-01T08:00:00.000Z");
const CUSTOM_RINGTONE = "data:audio/mpeg;base64,SUQzBAA=";

const play = vi.fn<() => Promise<void>>();
const AudioMock = vi.fn(function (this: {
  play: typeof play;
  onended: (() => void) | null;
}) {
  this.play = play;
  this.onended = null;
});

/** Satu tab = satu salinan modul; semua tab berbagi `localStorage`. */
async function openTab(): Promise<SoundModule> {
  vi.resetModules();
  return import("@/lib/notification-sound");
}

function setNavigatorProperty(
  name: "locks" | "userActivation",
  value: unknown,
) {
  Object.defineProperty(navigator, name, { value, configurable: true });
}

/** Lock manager bersama satu browser, seperti `navigator.locks`. */
function installLockManager() {
  const heldNames = new Set<string>();
  setNavigatorProperty("locks", {
    request: (
      name: string,
      _options: { ifAvailable?: boolean },
      callback: (lock: { name: string } | null) => Promise<unknown>,
    ) => {
      if (heldNames.has(name)) return Promise.resolve(callback(null));
      heldNames.add(name);
      return Promise.resolve()
        .then(() => callback({ name }))
        .finally(() => heldNames.delete(name));
    },
  });
}

describe("notification sound", () => {
  let sound: SoundModule;

  beforeEach(async () => {
    vi.useFakeTimers({ now: NOW });
    localStorage.clear();
    play.mockReset().mockResolvedValue(undefined);
    AudioMock.mockClear();
    vi.stubGlobal("Audio", AudioMock);
    sound = await openTab();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "locks");
    Reflect.deleteProperty(navigator, "userActivation");
  });

  it("points at a file that is actually served from public/", () => {
    expect(
      existsSync(join(process.cwd(), "public", NOTIFICATION_SOUND_SRC)),
    ).toBe(true);
  });

  describe("staff ringtone settings", () => {
    it("rings the default tone unless the ringtone is switched off", () => {
      sound.playStaffNotificationSound();
      expect(AudioMock).toHaveBeenCalledWith(NOTIFICATION_SOUND_SRC);
      expect(play).toHaveBeenCalledTimes(1);

      localStorage.setItem("chat_sound_enabled", "false");
      vi.advanceTimersByTime(NOTIFICATION_SOUND_THROTTLE_MS);
      sound.playStaffNotificationSound();

      expect(play).toHaveBeenCalledTimes(1);
    });

    it("rings the uploaded ringtone through a blob URL and releases it once played", () => {
      const createObjectURL = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue("blob:ringtone");
      const revokeObjectURL = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {});
      localStorage.setItem("chat_sound_type", "custom");
      localStorage.setItem("chat_custom_sound_data", CUSTOM_RINGTONE);

      sound.playStaffNotificationSound();

      expect((createObjectURL.mock.calls[0]?.[0] as Blob).type).toBe(
        "audio/mpeg",
      );
      expect(AudioMock).toHaveBeenCalledWith("blob:ringtone");
      expect(revokeObjectURL).not.toHaveBeenCalled();

      const audio = AudioMock.mock.instances[0] as { onended: () => void };
      audio.onended();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:ringtone");
    });

    it("releases the blob URL when the browser refuses to play", async () => {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:ringtone");
      const revokeObjectURL = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {});
      localStorage.setItem("chat_sound_type", "custom");
      localStorage.setItem("chat_custom_sound_data", CUSTOM_RINGTONE);
      play.mockRejectedValueOnce(
        new DOMException("blocked", "NotAllowedError"),
      );

      sound.playStaffNotificationSound();
      await vi.advanceTimersByTimeAsync(0);

      expect(revokeObjectURL).toHaveBeenCalledWith("blob:ringtone");
    });

    it("rings the default tone when custom is chosen but nothing was uploaded", () => {
      localStorage.setItem("chat_sound_type", "custom");

      sound.playStaffNotificationSound();

      expect(AudioMock).toHaveBeenCalledWith(NOTIFICATION_SOUND_SRC);
    });
  });

  describe("one sound per window", () => {
    it("rings once for a burst from several hooks, then again after the window", () => {
      for (let i = 0; i < 10; i++) {
        sound.playStaffNotificationSound();
        sound.playCustomerNotificationSound();
      }
      expect(play).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(NOTIFICATION_SOUND_THROTTLE_MS - 1);
      sound.playStaffNotificationSound();
      expect(play).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      sound.playStaffNotificationSound();
      expect(play).toHaveBeenCalledTimes(2);
    });

    it("keeps a second tab silent while the first tab's sound is within the window", async () => {
      sound.playStaffNotificationSound();
      const otherTab = await openTab();

      vi.advanceTimersByTime(500);
      otherTab.playStaffNotificationSound();
      expect(play).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(NOTIFICATION_SOUND_THROTTLE_MS);
      otherTab.playStaffNotificationSound();
      expect(play).toHaveBeenCalledTimes(2);
    });

    it("lets one tab hold the window even before the others can see its stamp", async () => {
      // Di browser, tulisan localStorage satu tab sampai ke tab lain secara
      // asinkron; tab yang memproses event yang sama di detik yang sama bisa
      // membaca nilai lama. Lock yang dipegang sepanjang jendela tidak.
      installLockManager();
      const otherTab = await openTab();

      sound.playStaffNotificationSound();
      await vi.advanceTimersByTimeAsync(0);
      localStorage.clear();
      otherTab.playStaffNotificationSound();
      await vi.advanceTimersByTimeAsync(0);
      expect(play).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(NOTIFICATION_SOUND_THROTTLE_MS);
      otherTab.playStaffNotificationSound();
      await vi.advanceTimersByTimeAsync(0);
      expect(play).toHaveBeenCalledTimes(2);
    });

    it("lets a tab the user has worked in ring before an untouched one", async () => {
      // Tab yang belum pernah disentuh biasanya ditolak autoplay; bila ia
      // menang lebih dulu, tidak ada yang terdengar sama sekali.
      const untouchedTab = await openTab();
      setNavigatorProperty("userActivation", { hasBeenActive: false });
      untouchedTab.playStaffNotificationSound();
      expect(play).not.toHaveBeenCalled();

      setNavigatorProperty("userActivation", { hasBeenActive: true });
      sound.playStaffNotificationSound();
      expect(play).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(play).toHaveBeenCalledTimes(1);
    });

    it("still rings in an untouched tab when no other tab did", async () => {
      setNavigatorProperty("userActivation", { hasBeenActive: false });

      sound.playStaffNotificationSound();
      expect(play).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1_000);
      expect(play).toHaveBeenCalledTimes(1);
    });

    it("is not silenced by a stamp left in the future by a clock that moved back", () => {
      localStorage.setItem(
        "notification_sound_last_played_at",
        String(NOW + 60 * 60_000),
      );

      sound.playStaffNotificationSound();

      expect(play).toHaveBeenCalledTimes(1);
    });

    it("still respects another tab's recent sound after this tab's clock moved back", () => {
      sound.playStaffNotificationSound();
      vi.setSystemTime(NOW - 60 * 60_000);
      localStorage.setItem(
        "notification_sound_last_played_at",
        String(Date.now() - 500),
      );

      sound.playStaffNotificationSound();

      expect(play).toHaveBeenCalledTimes(1);
    });
  });

  describe("quiet period", () => {
    it("holds every sound until the quiet period has passed", () => {
      sound.holdNotificationSounds();

      vi.advanceTimersByTime(NOTIFICATION_QUIET_PERIOD_MS - 1);
      sound.playStaffNotificationSound();
      sound.playCustomerNotificationSound();
      expect(play).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      sound.playStaffNotificationSound();
      expect(play).toHaveBeenCalledTimes(1);
    });

    it("restarts the quiet period on every hold", () => {
      sound.holdNotificationSounds();
      vi.advanceTimersByTime(3_000);
      sound.holdNotificationSounds();

      vi.advanceTimersByTime(NOTIFICATION_QUIET_PERIOD_MS - 1);
      sound.playStaffNotificationSound();
      expect(play).not.toHaveBeenCalled();
    });

    it("holds again after the clock moved back past an earlier hold", () => {
      sound.holdNotificationSounds();
      vi.setSystemTime(NOW - 60 * 60_000);

      sound.holdNotificationSounds();
      sound.playStaffNotificationSound();

      expect(play).not.toHaveBeenCalled();
    });

    it("does not stay silent for long when the clock moves back during a hold", () => {
      sound.holdNotificationSounds();
      vi.setSystemTime(NOW - 60 * 60_000);

      sound.playStaffNotificationSound();

      expect(play).toHaveBeenCalledTimes(1);
    });

    it("keeps an untouched tab silent when the hold starts while it waits its turn", async () => {
      setNavigatorProperty("userActivation", { hasBeenActive: false });

      sound.playStaffNotificationSound();
      sound.holdNotificationSounds();
      await vi.advanceTimersByTimeAsync(1_000);

      expect(play).not.toHaveBeenCalled();
    });
  });

  describe("previews from a button the user pressed", () => {
    it("ring at once, even while held or right after another sound", () => {
      sound.playStaffNotificationSound();
      sound.holdNotificationSounds();

      sound.previewStaffNotificationSound();
      sound.previewCustomerNotificationSound();

      expect(play).toHaveBeenCalledTimes(3);
    });

    it("stay silent for staff who switched the ringtone off", () => {
      localStorage.setItem("chat_sound_enabled", "false");

      sound.previewStaffNotificationSound();

      expect(play).not.toHaveBeenCalled();
    });
  });

  describe("customer portal", () => {
    it("plays for customers unless they turned it off", () => {
      expect(sound.isCustomerNotificationSoundEnabled()).toBe(true);

      sound.playCustomerNotificationSound();
      expect(AudioMock).toHaveBeenCalledWith(NOTIFICATION_SOUND_SRC);
      expect(play).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(NOTIFICATION_SOUND_THROTTLE_MS);
      sound.setCustomerNotificationSoundEnabled(false);
      expect(sound.isCustomerNotificationSoundEnabled()).toBe(false);
      sound.playCustomerNotificationSound();
      expect(play).toHaveBeenCalledTimes(1);

      sound.setCustomerNotificationSoundEnabled(true);
      sound.playCustomerNotificationSound();
      expect(play).toHaveBeenCalledTimes(2);
    });

    it("swallows the autoplay rejection a browser gives before any interaction", async () => {
      play.mockRejectedValueOnce(
        new DOMException("blocked", "NotAllowedError"),
      );

      expect(() => sound.playCustomerNotificationSound()).not.toThrow();
      await vi.advanceTimersByTimeAsync(0);
    });
  });
});
