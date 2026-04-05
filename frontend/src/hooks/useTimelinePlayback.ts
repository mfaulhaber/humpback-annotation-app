import { useEffect, useRef, useState } from "react";
import {
  audioChunkPath,
  chunkForTimestamp,
  manifestDuration,
  type TimelineManifest,
} from "../lib/timeline-contract.js";
import { createDebugLogger } from "../lib/debug-log.js";
import { clampTimestamp } from "../lib/timeline-math.js";

type AudioSlot = "primary" | "secondary";

function otherSlot(slot: AudioSlot): AudioSlot {
  return slot === "primary" ? "secondary" : "primary";
}

interface SeekOptions {
  autoplay?: boolean;
}

interface SeekableAudioLike {
  currentTime: number;
  duration: number;
  seeking: boolean;
  fastSeek?: (time: number) => void;
  addEventListener: (
    type: "seeked" | "timeupdate",
    listener: () => void,
  ) => void;
  removeEventListener: (
    type: "seeked" | "timeupdate",
    listener: () => void,
  ) => void;
}

const AUDIO_END_EPSILON_SEC = 0.01;
const AUDIO_OFFSET_TOLERANCE_SEC = 0.05;
const AUDIO_SEEK_TIMEOUT_MS = 5_000;
const PENDING_SEEK_TIMESTAMP_TOLERANCE_SEC = 0.5;
const TIMEUPDATE_DEBUG_LIMIT = 3;
const playbackDebug = createDebugLogger("timeline:playback");

export function resolvePlaybackStartTimestamp(
  requestedTimestamp: number | undefined,
  lastRequestedTimestamp: number | null,
  fallbackTimestamp: number,
): number {
  return requestedTimestamp ?? lastRequestedTimestamp ?? fallbackTimestamp;
}

export function clampAudioOffset(
  requestedOffset: number,
  duration: number,
): number {
  if (Number.isFinite(duration)) {
    return Math.min(requestedOffset, Math.max(duration - AUDIO_END_EPSILON_SEC, 0));
  }

  return Math.max(0, requestedOffset);
}

export function isAudioOffsetSettled(
  currentTime: number,
  requestedOffset: number,
): boolean {
  return Math.abs(currentTime - requestedOffset) <= AUDIO_OFFSET_TOLERANCE_SEC;
}

export function shouldIgnoreTimeUpdateDuringPendingSeek(
  nextTimestamp: number,
  requestedTimestamp: number,
): boolean {
  return (
    Math.abs(nextTimestamp - requestedTimestamp) >
    PENDING_SEEK_TIMESTAMP_TOLERANCE_SEC
  );
}

export async function awaitAudioOffset(
  audio: SeekableAudioLike,
  requestedOffset: number,
): Promise<number> {
  const clampedOffset = clampAudioOffset(requestedOffset, audio.duration);

  if (
    !audio.seeking &&
    isAudioOffsetSettled(audio.currentTime, clampedOffset)
  ) {
    return clampedOffset;
  }

  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      audio.removeEventListener("seeked", handleSeeked);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      globalThis.clearTimeout(timeoutId);
      globalThis.clearInterval(intervalId);
      resolve();
    };

    const handleSeeked = () => {
      if (
        !audio.seeking &&
        isAudioOffsetSettled(audio.currentTime, clampedOffset)
      ) {
        finish();
      }
    };

    const handleTimeUpdate = () => {
      if (
        !audio.seeking &&
        isAudioOffsetSettled(audio.currentTime, clampedOffset)
      ) {
        finish();
      }
    };

    const timeoutId = globalThis.setTimeout(finish, AUDIO_SEEK_TIMEOUT_MS);
    const intervalId = globalThis.setInterval(handleTimeUpdate, 50);

    audio.addEventListener("seeked", handleSeeked);
    audio.addEventListener("timeupdate", handleTimeUpdate);

    if (typeof audio.fastSeek === "function") {
      audio.fastSeek(clampedOffset);
    } else {
      audio.currentTime = clampedOffset;
    }

    if (
      !audio.seeking &&
      isAudioOffsetSettled(audio.currentTime, clampedOffset)
    ) {
      finish();
    }
  });

  return clampedOffset;
}

export function useTimelinePlayback(manifest: TimelineManifest | null) {
  const primaryAudioRef = useRef<HTMLAudioElement>(null);
  const secondaryAudioRef = useRef<HTMLAudioElement>(null);
  const activeSlotRef = useRef<AudioSlot>("primary");
  const loadedChunkRef = useRef<Record<AudioSlot, number | null>>({
    primary: null,
    secondary: null,
  });
  const lastRequestedTimestampRef = useRef<number | null>(null);
  const playbackRateRef = useRef(1);
  const seekSequenceRef = useRef(0);
  const pendingTimeUpdateDebugRef = useRef<{
    remaining: number;
    requestedTimestamp: number;
    seekId: number;
  } | null>(null);
  const pendingSeekRef = useRef<{
    requestedTimestamp: number;
    seekId: number;
    slot: AudioSlot;
  } | null>(null);
  const ignoredTimeUpdateCountRef = useRef(0);

  const [currentTimestamp, setCurrentTimestamp] = useState(
    manifest?.job.start_timestamp ?? 0,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  function updateCurrentTimestamp(
    nextTimestamp: number,
    source: string,
    details: Record<string, unknown> = {},
  ): void {
    playbackDebug("current-timestamp-set", {
      currentTimestamp: nextTimestamp,
      source,
      ...details,
    });
    setCurrentTimestamp(nextTimestamp);
  }

  function updateIsPlaying(
    nextIsPlaying: boolean,
    source: string,
    details: Record<string, unknown> = {},
  ): void {
    playbackDebug("is-playing-set", {
      isPlaying: nextIsPlaying,
      source,
      ...details,
    });
    setIsPlaying(nextIsPlaying);
  }

  function getAudio(slot: AudioSlot): HTMLAudioElement | null {
    return slot === "primary"
      ? primaryAudioRef.current
      : secondaryAudioRef.current;
  }

  useEffect(() => {
    if (!manifest) {
      return;
    }

    updateCurrentTimestamp(manifest.job.start_timestamp, "manifest-reset");
    updateIsPlaying(false, "manifest-reset");
    activeSlotRef.current = "primary";
    loadedChunkRef.current = {
      primary: null,
      secondary: null,
    };
    lastRequestedTimestampRef.current = manifest.job.start_timestamp;

    const primaryAudio = primaryAudioRef.current;
    const secondaryAudio = secondaryAudioRef.current;

    if (primaryAudio) {
      primaryAudio.pause();
      primaryAudio.removeAttribute("src");
      primaryAudio.load();
    }

    if (secondaryAudio) {
      secondaryAudio.pause();
      secondaryAudio.removeAttribute("src");
      secondaryAudio.load();
    }
  }, [manifest]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
    const primaryAudio = primaryAudioRef.current;
    const secondaryAudio = secondaryAudioRef.current;

    if (primaryAudio) {
      primaryAudio.playbackRate = playbackRate;
    }

    if (secondaryAudio) {
      secondaryAudio.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  async function loadChunk(slot: AudioSlot, chunkIndex: number): Promise<void> {
    if (!manifest || chunkIndex < 0 || chunkIndex >= manifest.audio.chunk_count) {
      return;
    }

    const audio = getAudio(slot);
    if (!audio) {
      return;
    }

    if (loadedChunkRef.current[slot] === chunkIndex) {
      playbackDebug("load-chunk-skip", {
        chunkIndex,
        slot,
      });
      return;
    }

    playbackDebug("load-chunk-start", {
      chunkIndex,
      slot,
    });
    audio.pause();
    audio.preload = "auto";
    audio.src = audioChunkPath(manifest.job.id, chunkIndex);
    audio.playbackRate = playbackRateRef.current;

    await new Promise<void>((resolve, reject) => {
      const finishLoaded = () => {
        audio.removeEventListener("loadeddata", handleLoadedData);
        audio.removeEventListener("canplay", handleCanPlay);
        audio.removeEventListener("error", handleError);
        loadedChunkRef.current[slot] = chunkIndex;
        playbackDebug("load-chunk-ready", {
          chunkIndex,
          duration: audio.duration,
          readyState: audio.readyState,
          slot,
        });
        resolve();
      };

      const handleError = () => {
        audio.removeEventListener("loadeddata", handleLoadedData);
        audio.removeEventListener("canplay", handleCanPlay);
        audio.removeEventListener("error", handleError);
        loadedChunkRef.current[slot] = null;
        reject(new Error(`Failed to load audio chunk ${chunkIndex}`));
      };

      const handleLoadedData = () => {
        if (audio.readyState >= 2) {
          finishLoaded();
        }
      };

      const handleCanPlay = () => {
        if (audio.readyState >= 2) {
          finishLoaded();
        }
      };

      audio.addEventListener("loadeddata", handleLoadedData);
      audio.addEventListener("canplay", handleCanPlay);
      audio.addEventListener("error", handleError);
      audio.load();

      if (audio.readyState >= 2) {
        finishLoaded();
      }
    });
  }

  async function prefetchNextChunk(baseChunkIndex: number): Promise<void> {
    if (!manifest) {
      return;
    }

    const nextChunkIndex = baseChunkIndex + 1;
    if (nextChunkIndex >= manifest.audio.chunk_count) {
      return;
    }

    const passiveSlot = otherSlot(activeSlotRef.current);

    try {
      await loadChunk(passiveSlot, nextChunkIndex);
    } catch {
      // The viewer can continue with the current chunk and recover on seek.
    }
  }

  async function seek(timestamp: number, options: SeekOptions = {}): Promise<void> {
    if (!manifest) {
      return;
    }

    const nextTimestamp = clampTimestamp(manifest, timestamp);
    lastRequestedTimestampRef.current = nextTimestamp;

    const chunkIndex = chunkForTimestamp(manifest, nextTimestamp);
    const chunkStart =
      manifest.job.start_timestamp + chunkIndex * manifest.audio.chunk_duration_sec;
    const offset = Math.max(0, nextTimestamp - chunkStart);
    const activeSlot = activeSlotRef.current;
    const activeAudio = getAudio(activeSlot);
    const seekId = seekSequenceRef.current + 1;
    seekSequenceRef.current = seekId;

    if (!activeAudio) {
      return;
    }

    playbackDebug("seek-request", {
      activeSlot,
      autoplay: options.autoplay ?? false,
      chunkIndex,
      chunkStart,
      offset,
      requestedTimestamp: nextTimestamp,
      seekId,
    });

    if (!options.autoplay) {
      pendingSeekRef.current = null;
      pendingTimeUpdateDebugRef.current = null;
      playbackDebug("seek-deferred-while-paused", {
        requestedTimestamp: nextTimestamp,
        seekId,
      });
      updateCurrentTimestamp(nextTimestamp, "seek-deferred-while-paused", {
        requestedTimestamp: nextTimestamp,
        seekId,
      });
      return;
    }

    pendingSeekRef.current = {
      requestedTimestamp: nextTimestamp,
      seekId,
      slot: activeSlot,
    };
    await loadChunk(activeSlot, chunkIndex);

    if (seekId !== seekSequenceRef.current) {
      playbackDebug("seek-aborted-stale", {
        latestSeekId: seekSequenceRef.current,
        phase: "after-load-chunk",
        seekId,
      });
      return;
    }

    const clampedOffset = await awaitAudioOffset(activeAudio, offset);

    if (seekId !== seekSequenceRef.current) {
      playbackDebug("seek-aborted-stale", {
        latestSeekId: seekSequenceRef.current,
        phase: "after-await-audio-offset",
        seekId,
      });
      return;
    }

    pendingTimeUpdateDebugRef.current = {
      remaining: TIMEUPDATE_DEBUG_LIMIT,
      requestedTimestamp: nextTimestamp,
      seekId,
    };
    playbackDebug("seek-offset-settled", {
      audioCurrentTime: activeAudio.currentTime,
      chunkIndex,
      clampedOffset,
      offsetSettled: isAudioOffsetSettled(activeAudio.currentTime, clampedOffset),
      requestedTimestamp: nextTimestamp,
      seekId,
    });
    updateCurrentTimestamp(nextTimestamp, "seek-autoplay-start", {
      requestedTimestamp: nextTimestamp,
      seekId,
    });
    void prefetchNextChunk(chunkIndex);

    if (options.autoplay) {
      try {
        if (seekId !== seekSequenceRef.current) {
          playbackDebug("seek-aborted-stale", {
            latestSeekId: seekSequenceRef.current,
            phase: "before-play",
            seekId,
          });
          return;
        }
        playbackDebug("play-start", {
          audioCurrentTime: activeAudio.currentTime,
          chunkIndex,
          requestedTimestamp: nextTimestamp,
          seekId,
        });
        await activeAudio.play();
        playbackDebug("play-started", {
          audioCurrentTime: activeAudio.currentTime,
          chunkIndex,
          requestedTimestamp: nextTimestamp,
          seekId,
        });
        updateIsPlaying(true, "play-started", {
          requestedTimestamp: nextTimestamp,
          seekId,
        });
      } catch {
        playbackDebug("play-failed", {
          chunkIndex,
          requestedTimestamp: nextTimestamp,
          seekId,
        });
        updateIsPlaying(false, "play-failed", {
          requestedTimestamp: nextTimestamp,
          seekId,
        });
      }
    }
  }

  function pause(): void {
    seekSequenceRef.current += 1;
    pendingSeekRef.current = null;
    pendingTimeUpdateDebugRef.current = null;
    playbackDebug("pause", {
      currentTimestamp,
    });
    primaryAudioRef.current?.pause();
    secondaryAudioRef.current?.pause();
    updateIsPlaying(false, "pause");
  }

  async function togglePlay(requestedTimestamp?: number): Promise<void> {
    if (!manifest) {
      return;
    }

    if (isPlaying) {
      pause();
      return;
    }

    const timestamp = resolvePlaybackStartTimestamp(
      requestedTimestamp,
      lastRequestedTimestampRef.current,
      manifest.job.start_timestamp,
    );
    playbackDebug("toggle-play", {
      currentTimestamp,
      isPlaying,
      lastRequestedTimestamp: lastRequestedTimestampRef.current,
      requestedTimestamp,
      resolvedTimestamp: timestamp,
    });
    await seek(timestamp, { autoplay: true });
  }

  async function skipBy(seconds: number): Promise<void> {
    if (!manifest) {
      return;
    }

    await seek(currentTimestamp + seconds, { autoplay: isPlaying });
  }

  function cyclePlaybackRate(): void {
    const rates = [0.5, 1, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRateRef.current);
    const nextRate = rates[(currentIndex + 1 + rates.length) % rates.length]!;
    setPlaybackRate(nextRate);
  }

  useEffect(() => {
    playbackDebug("state-snapshot", {
      currentTimestamp,
      isPlaying,
      lastRequestedTimestamp: lastRequestedTimestampRef.current,
      pendingSeek: pendingSeekRef.current,
    });
  }, [currentTimestamp, isPlaying]);

  useEffect(() => {
    if (!manifest) {
      return;
    }

    const activeManifest = manifest;
    const primaryAudio = primaryAudioRef.current;
    const secondaryAudio = secondaryAudioRef.current;

    if (!primaryAudio || !secondaryAudio) {
      return;
    }

    function bindAudio(slot: AudioSlot, audio: HTMLAudioElement) {
      const handleTimeUpdate = () => {
        if (activeSlotRef.current !== slot) {
          return;
        }

        const chunkIndex = loadedChunkRef.current[slot];
        if (chunkIndex == null) {
          return;
        }

        const chunkStart =
          activeManifest.job.start_timestamp +
          chunkIndex * activeManifest.audio.chunk_duration_sec;
        const nextTimestamp = Math.min(
          activeManifest.job.end_timestamp,
          chunkStart + audio.currentTime,
        );
        const pendingSeek = pendingSeekRef.current;
        const pendingDebug = pendingTimeUpdateDebugRef.current;

        if (
          pendingSeek &&
          pendingSeek.slot === slot &&
          shouldIgnoreTimeUpdateDuringPendingSeek(
            nextTimestamp,
            pendingSeek.requestedTimestamp,
          )
        ) {
          playbackDebug("timeupdate-ignored-pending-seek", {
            audioCurrentTime: audio.currentTime,
            chunkIndex,
            chunkStart,
            ignoredCount: ignoredTimeUpdateCountRef.current + 1,
            nextTimestamp,
            requestedTimestamp: pendingSeek.requestedTimestamp,
            seekId: pendingSeek.seekId,
            slot,
          });
          ignoredTimeUpdateCountRef.current += 1;
          return;
        }

        if (ignoredTimeUpdateCountRef.current > 0) {
          playbackDebug("timeupdate-resumed-after-ignore", {
            chunkIndex,
            ignoredCount: ignoredTimeUpdateCountRef.current,
            nextTimestamp,
            slot,
          });
          ignoredTimeUpdateCountRef.current = 0;
        }

        if (pendingDebug && pendingDebug.remaining > 0) {
          playbackDebug("timeupdate-after-seek", {
            audioCurrentTime: audio.currentTime,
            chunkIndex,
            chunkStart,
            deltaFromRequested:
              nextTimestamp - pendingDebug.requestedTimestamp,
            nextTimestamp,
            requestedTimestamp: pendingDebug.requestedTimestamp,
            seekId: pendingDebug.seekId,
            slot,
          });
          pendingDebug.remaining -= 1;
          if (pendingDebug.remaining === 0) {
            pendingTimeUpdateDebugRef.current = null;
          }
        }

        if (pendingSeek && pendingSeek.slot === slot) {
          playbackDebug("pending-seek-cleared", {
            nextTimestamp,
            requestedTimestamp: pendingSeek.requestedTimestamp,
            seekId: pendingSeek.seekId,
            slot,
          });
          pendingSeekRef.current = null;
        }

        lastRequestedTimestampRef.current = nextTimestamp;
        updateCurrentTimestamp(nextTimestamp, "timeupdate", {
          audioCurrentTime: audio.currentTime,
          chunkIndex,
          slot,
        });
      };

      const handleEnded = () => {
        if (activeSlotRef.current !== slot) {
          return;
        }

        const activeChunkIndex = loadedChunkRef.current[slot];
        if (activeChunkIndex == null) {
          updateIsPlaying(false, "ended-missing-active-chunk", {
            slot,
          });
          return;
        }

        const nextChunkIndex = activeChunkIndex + 1;
        if (nextChunkIndex >= activeManifest.audio.chunk_count) {
          updateCurrentTimestamp(
            activeManifest.job.end_timestamp,
            "ended-reached-end",
          );
          lastRequestedTimestampRef.current = activeManifest.job.end_timestamp;
          updateIsPlaying(false, "ended-reached-end");
          return;
        }

        const passiveSlot = otherSlot(slot);
        const passiveAudio = getAudio(passiveSlot);

        if (
          passiveAudio &&
          loadedChunkRef.current[passiveSlot] === nextChunkIndex &&
          passiveAudio.readyState >= 2
        ) {
          activeSlotRef.current = passiveSlot;
          passiveAudio.currentTime = 0;
          passiveAudio.playbackRate = playbackRateRef.current;
          void passiveAudio.play().catch(() => {
            updateIsPlaying(false, "ended-passive-play-failed", {
              nextChunkIndex,
            });
          });
          void prefetchNextChunk(nextChunkIndex);
          return;
        }

        const nextTimestamp =
          activeManifest.job.start_timestamp +
          nextChunkIndex * activeManifest.audio.chunk_duration_sec;
        void seek(nextTimestamp, { autoplay: true });
      };

      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("ended", handleEnded);

      return () => {
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("ended", handleEnded);
      };
    }

    const cleanupPrimary = bindAudio("primary", primaryAudio);
    const cleanupSecondary = bindAudio("secondary", secondaryAudio);

    return () => {
      cleanupPrimary?.();
      cleanupSecondary?.();
    };
  }, [manifest]);

  const canPlay = manifest ? manifestDuration(manifest) > 0 : false;

  return {
    canPlay,
    currentTimestamp,
    isPlaying,
    playbackRate,
    primaryAudioRef,
    secondaryAudioRef,
    pause,
    seek,
    skipBy,
    togglePlay,
    cyclePlaybackRate,
  };
}
