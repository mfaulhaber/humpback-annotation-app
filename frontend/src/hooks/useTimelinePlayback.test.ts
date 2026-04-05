import { describe, expect, it, vi } from "vitest";

import {
  awaitAudioOffset,
  clampAudioOffset,
  isAudioOffsetSettled,
  resolvePlaybackStartTimestamp,
  shouldIgnoreTimeUpdateDuringPendingSeek,
} from "./useTimelinePlayback.js";

class FakeSeekableAudio implements EventTarget {
  private readonly target = new EventTarget();
  private nextOffset = 0;
  private current = 0;

  duration: number;
  seeking = false;

  constructor(duration: number) {
    this.duration = duration;
  }

  get currentTime(): number {
    return this.current;
  }

  set currentTime(value: number) {
    this.nextOffset = value;
    this.seeking = true;

    globalThis.setTimeout(() => {
      this.current = this.nextOffset;
      this.seeking = false;
      this.dispatchEvent(new Event("seeked"));
    }, 25);
  }

  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    this.target.addEventListener(type, callback, options);
  }

  dispatchEvent(event: Event): boolean {
    return this.target.dispatchEvent(event);
  }

  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    this.target.removeEventListener(type, callback, options);
  }
}

describe("useTimelinePlayback helpers", () => {
  it("prefers the current centered timestamp when starting playback", () => {
    expect(resolvePlaybackStartTimestamp(325, 120, 0)).toBe(325);
  });

  it("falls back to the last requested playback timestamp", () => {
    expect(resolvePlaybackStartTimestamp(undefined, 120, 0)).toBe(120);
  });

  it("falls back to the manifest start when no other timestamp exists", () => {
    expect(resolvePlaybackStartTimestamp(undefined, null, 45)).toBe(45);
  });

  it("clamps offsets to just before the end of a loaded chunk", () => {
    expect(clampAudioOffset(305, 300)).toBe(299.99);
  });

  it("recognizes when an audio element has actually reached the requested offset", () => {
    expect(isAudioOffsetSettled(169.75, 169.745)).toBe(true);
    expect(isAudioOffsetSettled(0, 169.745)).toBe(false);
  });

  it("ignores stale timeupdates that snap back to the chunk boundary during a pending seek", () => {
    expect(
      shouldIgnoreTimeUpdateDuringPendingSeek(1_635_473_700, 1_635_473_869.745),
    ).toBe(true);
    expect(
      shouldIgnoreTimeUpdateDuringPendingSeek(1_635_473_869.9, 1_635_473_869.745),
    ).toBe(false);
  });

  it("waits for the audio element to finish seeking before continuing", async () => {
    vi.useFakeTimers();

    const audio = new FakeSeekableAudio(300);
    const seekPromise = awaitAudioOffset(audio, 90);

    expect(audio.currentTime).toBe(0);

    await vi.advanceTimersByTimeAsync(25);

    await expect(seekPromise).resolves.toBe(90);
    expect(audio.currentTime).toBe(90);
    expect(audio.seeking).toBe(false);

    vi.useRealTimers();
  });
});
