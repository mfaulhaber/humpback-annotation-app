import { useEffect, useRef, useState } from "react";
import {
  audioChunkPath,
  chunkForTimestamp,
  manifestDuration,
  type TimelineManifest,
} from "../lib/timeline-contract.js";
import { clampTimestamp } from "../lib/timeline-math.js";

type AudioSlot = "primary" | "secondary";

function otherSlot(slot: AudioSlot): AudioSlot {
  return slot === "primary" ? "secondary" : "primary";
}

interface SeekOptions {
  autoplay?: boolean;
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

  const [currentTimestamp, setCurrentTimestamp] = useState(
    manifest?.job.start_timestamp ?? 0,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  function getAudio(slot: AudioSlot): HTMLAudioElement | null {
    return slot === "primary"
      ? primaryAudioRef.current
      : secondaryAudioRef.current;
  }

  useEffect(() => {
    if (!manifest) {
      return;
    }

    setCurrentTimestamp(manifest.job.start_timestamp);
    setIsPlaying(false);
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
      return;
    }

    audio.pause();
    audio.preload = "auto";
    audio.src = audioChunkPath(manifest.job.id, chunkIndex);
    audio.playbackRate = playbackRateRef.current;

    await new Promise<void>((resolve, reject) => {
      const handleLoaded = () => {
        audio.removeEventListener("loadedmetadata", handleLoaded);
        audio.removeEventListener("error", handleError);
        loadedChunkRef.current[slot] = chunkIndex;
        resolve();
      };

      const handleError = () => {
        audio.removeEventListener("loadedmetadata", handleLoaded);
        audio.removeEventListener("error", handleError);
        loadedChunkRef.current[slot] = null;
        reject(new Error(`Failed to load audio chunk ${chunkIndex}`));
      };

      audio.addEventListener("loadedmetadata", handleLoaded);
      audio.addEventListener("error", handleError);
      audio.load();
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

    if (!activeAudio) {
      return;
    }

    await loadChunk(activeSlot, chunkIndex);

    const safeDuration = Number.isFinite(activeAudio.duration)
      ? Math.max(activeAudio.duration - 0.01, 0)
      : offset;

    activeAudio.currentTime = Math.min(offset, safeDuration);
    setCurrentTimestamp(nextTimestamp);

    await prefetchNextChunk(chunkIndex);

    if (options.autoplay) {
      try {
        await activeAudio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  }

  function pause(): void {
    primaryAudioRef.current?.pause();
    secondaryAudioRef.current?.pause();
    setIsPlaying(false);
  }

  async function togglePlay(): Promise<void> {
    if (!manifest) {
      return;
    }

    if (isPlaying) {
      pause();
      return;
    }

    const timestamp =
      lastRequestedTimestampRef.current ?? manifest.job.start_timestamp;
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

        lastRequestedTimestampRef.current = nextTimestamp;
        setCurrentTimestamp(nextTimestamp);
      };

      const handleEnded = () => {
        if (activeSlotRef.current !== slot) {
          return;
        }

        const activeChunkIndex = loadedChunkRef.current[slot];
        if (activeChunkIndex == null) {
          setIsPlaying(false);
          return;
        }

        const nextChunkIndex = activeChunkIndex + 1;
        if (nextChunkIndex >= activeManifest.audio.chunk_count) {
          setCurrentTimestamp(activeManifest.job.end_timestamp);
          lastRequestedTimestampRef.current = activeManifest.job.end_timestamp;
          setIsPlaying(false);
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
            setIsPlaying(false);
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
