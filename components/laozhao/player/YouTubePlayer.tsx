"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { ExternalLink, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import type { LaoZhaoChapter } from "./content-contract";
import type { LaoZhaoPlayerError, LaoZhaoPlayerState } from "./types";

type YouTubePlayerStateCode = -1 | 0 | 1 | 2 | 3 | 5;

type YouTubePlayerInstance = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getIframe: () => HTMLIFrameElement;
  getPlayerState: () => YouTubePlayerStateCode;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      height: string;
      width: string;
      videoId: string;
      host: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: { target: YouTubePlayerInstance }) => void;
        onStateChange: (event: { target: YouTubePlayerInstance; data: YouTubePlayerStateCode }) => void;
        onError: (event: { data: number }) => void;
      };
    }
  ) => YouTubePlayerInstance;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("播放器只能在瀏覽器載入"));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    let settled = false;
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-laozhao-youtube-api]");
    const previousReady = window.onYouTubeIframeAPIReady;

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.onYouTubeIframeAPIReady = previousReady;
      document.querySelector<HTMLScriptElement>("script[data-laozhao-youtube-api]")?.remove();
      reject(new Error(message));
    };

    const timeoutId = window.setTimeout(() => {
      fail("YouTube 播放器載入逾時");
    }, 12000);

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (settled) return;
      if (!window.YT?.Player) {
        fail("YouTube 播放器介面未完成載入");
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      window.onYouTubeIframeAPIReady = previousReady;
      resolve(window.YT);
    };

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.laozhaoYoutubeApi = "true";
      script.onerror = () => fail("YouTube 播放器載入失敗");
      document.head.appendChild(script);
    }
  });

  const currentPromise = youtubeApiPromise;
  void currentPromise.catch(() => {
    if (youtubeApiPromise === currentPromise) youtubeApiPromise = null;
  });

  return youtubeApiPromise;
}

function normalizeVideoId(videoId: string) {
  return /^[A-Za-z0-9_-]{6,20}$/.test(videoId);
}

function getStateLabel(state: LaoZhaoPlayerState) {
  if (state === "loading") return "正在載入播放器";
  if (state === "ready") return "播放器已準備好";
  if (state === "playing") return "播放中";
  if (state === "paused") return "已暫停";
  if (state === "ended") return "已播放完畢";
  if (state === "error") return "播放器暫時無法使用";
  return "播放器尚未載入";
}

function getChapterAtTime(
  chapters: readonly LaoZhaoChapter[],
  seconds: number,
  allowDrafts: boolean
) {
  let current: LaoZhaoChapter | null = null;
  for (const chapter of chapters) {
    if (chapter.reviewStatus !== "reviewed" && !allowDrafts) continue;
    if (seconds >= chapter.startSec && (chapter.endSec === undefined || seconds < chapter.endSec)) {
      current = chapter;
    }
  }
  return current;
}

function readPlayerTime(player: YouTubePlayerInstance | null) {
  if (!player || typeof player.getCurrentTime !== "function") return 0;
  try {
    return Math.max(0, Number(player.getCurrentTime()) || 0);
  } catch {
    return 0;
  }
}

function readPlayerDuration(player: YouTubePlayerInstance | null) {
  if (!player || typeof player.getDuration !== "function") return 0;
  try {
    return Math.max(0, Number(player.getDuration()) || 0);
  } catch {
    return 0;
  }
}

function readPlayerState(player: YouTubePlayerInstance | null) {
  if (!player || typeof player.getPlayerState !== "function") return null;
  try {
    return player.getPlayerState();
  } catch {
    return null;
  }
}

function destroyPlayer(player: YouTubePlayerInstance | null) {
  if (!player || typeof player.destroy !== "function") return;
  try {
    player.destroy();
  } catch {
    // The YouTube API can expose a constructor shell before the iframe is ready.
  }
}

type WebkitFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type WebkitFullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

function readFullscreenElement() {
  const fullscreenDocument = document as WebkitFullscreenDocument;
  return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
}

async function requestElementFullscreen(element: HTMLElement) {
  if (typeof element.requestFullscreen === "function") {
    await element.requestFullscreen();
    return true;
  }
  const webkitElement = element as WebkitFullscreenElement;
  if (typeof webkitElement.webkitRequestFullscreen === "function") {
    await webkitElement.webkitRequestFullscreen();
    return true;
  }
  return false;
}

async function exitElementFullscreen() {
  if (typeof document.exitFullscreen === "function") {
    await document.exitFullscreen();
    return;
  }
  const fullscreenDocument = document as WebkitFullscreenDocument;
  await fullscreenDocument.webkitExitFullscreen?.();
}

export type LaoZhaoPlayerHandle = {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
};

type YouTubePlayerProps = {
  videoId: string;
  title: string;
  initialSeekSeconds?: number;
  chapters?: readonly LaoZhaoChapter[];
  playable?: boolean;
  allowDrafts?: boolean;
  captionText?: string;
  onChapterChange?: (chapter: LaoZhaoChapter | null) => void;
  onTimeUpdate?: (seconds: number) => void;
  onProgressCheckpoint?: (
    seconds: number,
    duration: number,
    completed: boolean,
    watchedRanges: readonly [number, number][]
  ) => void;
};

function appendWatchedRange(
  ranges: Array<[number, number]>,
  startSec: number,
  endSec: number
) {
  if (endSec <= startSec) return;
  const previous = ranges[ranges.length - 1];
  if (previous && startSec <= previous[1] + 0.5) {
    previous[1] = Math.max(previous[1], endSec);
    return;
  }
  ranges.push([startSec, endSec]);
}

export const YouTubePlayer = forwardRef<LaoZhaoPlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
  {
    videoId,
    title,
    initialSeekSeconds = 0,
    chapters = [],
    playable = true,
    allowDrafts = false,
    captionText = "",
    onChapterChange,
    onTimeUpdate,
    onProgressCheckpoint
  },
  ref
) {
  const frameRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const pollingRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const lastCheckpointRef = useRef(0);
  const watchedRangesRef = useRef<Array<[number, number]>>([]);
  const lastChapterIdRef = useRef<string | null>(null);
  const initialSeekRef = useRef(Math.max(0, Math.floor(Number(initialSeekSeconds) || 0)));
  const pendingSeekRef = useRef<number | null>(null);
  const requestedSeekRef = useRef<number | null>(null);
  const onChapterChangeRef = useRef(onChapterChange);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onProgressCheckpointRef = useRef(onProgressCheckpoint);
  const [state, setState] = useState<LaoZhaoPlayerState>(playable ? "loading" : "error");
  const [error, setError] = useState<LaoZhaoPlayerError | null>(
    playable ? null : { code: 150, message: "這支影片目前無法嵌入播放" }
  );
  const [timeLabel, setTimeLabel] = useState("0:00");
  const [retryKey, setRetryKey] = useState(0);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const fullscreenActive = nativeFullscreen || fallbackFullscreen;

  useEffect(() => {
    onChapterChangeRef.current = onChapterChange;
  }, [onChapterChange]);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useEffect(() => {
    onProgressCheckpointRef.current = onProgressCheckpoint;
  }, [onProgressCheckpoint]);

  useEffect(() => {
    const syncFullscreenState = () => {
      const active = readFullscreenElement() === frameRef.current;
      setNativeFullscreen(active);
      if (active) setFallbackFullscreen(false);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    if (!fallbackFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFallbackFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [fallbackFullscreen]);

  const handleFullscreenToggle = useCallback(async () => {
    const frame = frameRef.current;
    if (!frame) return;
    if (readFullscreenElement() === frame) {
      await exitElementFullscreen();
      return;
    }
    if (fallbackFullscreen) {
      setFallbackFullscreen(false);
      return;
    }
    try {
      const requested = await requestElementFullscreen(frame);
      if (requested) {
        setNativeFullscreen(true);
        return;
      }
    } catch {
      // iPhone Safari may expose the API but reject non-video elements.
    }
    setFallbackFullscreen(true);
  }, [fallbackFullscreen]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const readResolvedTime = useCallback((player: YouTubePlayerInstance | null) => {
    const actualSeconds = readPlayerTime(player);
    const requestedSeconds = requestedSeekRef.current;
    if (requestedSeconds !== null && requestedSeconds > 0 && actualSeconds === 0) {
      return requestedSeconds;
    }
    if (requestedSeconds !== null) requestedSeekRef.current = null;
    return actualSeconds;
  }, []);

  const emitCheckpoint = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const seconds = readResolvedTime(player);
    const duration = readPlayerDuration(player);
    lastTimeRef.current = seconds;
    const completed = duration > 0 && seconds >= duration - 3;
    onProgressCheckpointRef.current?.(
      seconds,
      duration,
      completed,
      watchedRangesRef.current.map(([startSec, endSec]) => [startSec, endSec])
    );
    lastCheckpointRef.current = seconds;
  }, [readResolvedTime]);

  const pollTime = useCallback(
    (forceCheckpoint = false) => {
      const player = playerRef.current;
      if (!player) return;
      const seconds = readResolvedTime(player);
      const duration = readPlayerDuration(player);
      const previousSeconds = lastTimeRef.current;
      if (
        readPlayerState(player) === 1 &&
        seconds > previousSeconds &&
        seconds - previousSeconds <= 2.5
      ) {
        appendWatchedRange(watchedRangesRef.current, previousSeconds, seconds);
      }
      lastTimeRef.current = seconds;
      setTimeLabel(formatPlayerTime(seconds));
      onTimeUpdateRef.current?.(seconds);

      const chapter = getChapterAtTime(chapters, seconds, allowDrafts);
      const chapterId = chapter?.stableId ?? null;
      if (chapterId !== lastChapterIdRef.current) {
        lastChapterIdRef.current = chapterId;
        onChapterChangeRef.current?.(chapter);
      }

      if (forceCheckpoint || Math.abs(seconds - lastCheckpointRef.current) >= 10) {
        const completed = duration > 0 && seconds >= duration - 3;
        onProgressCheckpointRef.current?.(
          seconds,
          duration,
          completed,
          watchedRangesRef.current.map(([startSec, endSec]) => [startSec, endSec])
        );
        lastCheckpointRef.current = seconds;
      }
    },
    [allowDrafts, chapters, readResolvedTime]
  );

  const startPolling = useCallback(() => {
    stopPolling();
    if (document.visibilityState !== "visible") return;
    pollTime();
    pollingRef.current = window.setInterval(() => pollTime(), 1000);
  }, [pollTime, stopPolling]);

  useImperativeHandle(
    ref,
    () => ({
      seekTo: (seconds: number) => {
        const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
        const player = playerRef.current;
        if (!player || typeof player.seekTo !== "function") {
          pendingSeekRef.current = safeSeconds;
          requestedSeekRef.current = safeSeconds;
          initialSeekRef.current = safeSeconds;
          lastTimeRef.current = safeSeconds;
          lastCheckpointRef.current = safeSeconds;
          setTimeLabel(formatPlayerTime(safeSeconds));
          onTimeUpdateRef.current?.(safeSeconds);
          return;
        }
        pendingSeekRef.current = null;
        requestedSeekRef.current = safeSeconds;
        player.seekTo(safeSeconds, true);
        lastTimeRef.current = safeSeconds;
        lastCheckpointRef.current = safeSeconds;
        setTimeLabel(formatPlayerTime(safeSeconds));
        onTimeUpdateRef.current?.(safeSeconds);
        const chapter = getChapterAtTime(chapters, safeSeconds, allowDrafts);
        lastChapterIdRef.current = chapter?.stableId ?? null;
        onChapterChangeRef.current?.(chapter);
      },
      getCurrentTime: () => lastTimeRef.current || readPlayerTime(playerRef.current)
    }),
    [allowDrafts, chapters]
  );

  useEffect(() => {
    if (!playable || !normalizeVideoId(videoId) || !containerRef.current) {
      setState("error");
      setError({ code: 150, message: "影片連結格式無法驗證" });
      return;
    }

    let cancelled = false;
    let createdPlayer: YouTubePlayerInstance | null = null;
    const mountNode = containerRef.current;
    initialSeekRef.current = Math.max(0, Math.floor(Number(initialSeekSeconds) || 0));
    lastTimeRef.current = initialSeekRef.current;
    lastCheckpointRef.current = initialSeekRef.current;
    watchedRangesRef.current = [];
    lastChapterIdRef.current = null;
    pendingSeekRef.current = null;
    requestedSeekRef.current = initialSeekRef.current > 0 ? initialSeekRef.current : null;
    mountNode.replaceChildren();
    setState("loading");
    setError(null);
    setTimeLabel(formatPlayerTime(initialSeekRef.current));

    loadYouTubeApi()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        const playerVars: Record<string, string | number> = {
          autoplay: 0,
          cc_load_policy: 0,
          controls: 1,
          enablejsapi: 1,
          fs: 0,
          modestbranding: 1,
          origin: window.location.origin,
          playsinline: 1,
          rel: 0
        };
        if (initialSeekRef.current > 0) playerVars.start = initialSeekRef.current;
        const player = new api.Player(containerRef.current, {
          height: "100%",
          width: "100%",
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars,
          events: {
            onReady: ({ target }) => {
              if (cancelled) {
                destroyPlayer(target);
                return;
              }
              playerRef.current = target;
              if (typeof target.getIframe === "function") {
                target.getIframe().setAttribute("title", `播放：${title}`);
              }
              setState("ready");
              const pendingSeconds = pendingSeekRef.current;
              const initialSeconds = pendingSeconds ?? initialSeekRef.current;
              pendingSeekRef.current = null;
              if (pendingSeconds !== null && initialSeconds > 0 && typeof target.seekTo === "function") {
                requestedSeekRef.current = initialSeconds;
                target.seekTo(initialSeconds, true);
                lastTimeRef.current = initialSeconds;
                lastCheckpointRef.current = initialSeconds;
                setTimeLabel(formatPlayerTime(initialSeconds));
              } else if (initialSeconds > 0) {
                requestedSeekRef.current = initialSeconds;
                lastTimeRef.current = initialSeconds;
                lastCheckpointRef.current = initialSeconds;
                setTimeLabel(formatPlayerTime(initialSeconds));
              } else {
                requestedSeekRef.current = null;
                pollTime(true);
              }
            },
            onStateChange: ({ data }) => {
              if (cancelled) return;
              if (data === 1) {
                setState("playing");
                startPolling();
                return;
              }
              if (data === 0) {
                setState("ended");
                stopPolling();
                pollTime(true);
                emitCheckpoint();
                return;
              }
              if (data === 2) {
                setState("paused");
                stopPolling();
                pollTime(true);
                emitCheckpoint();
                return;
              }
              if (data === 3) setState("loading");
            },
            onError: ({ data }) => {
              if (cancelled) return;
              stopPolling();
              setState("error");
              setError({ code: data, message: getYouTubeErrorMessage(data) });
            }
          }
        });
        createdPlayer = player;
      })
      .catch((rawError: unknown) => {
        if (cancelled) return;
        setState("error");
        setError({ code: 153, message: rawError instanceof Error ? rawError.message : "YouTube 播放器載入失敗" });
      });

    return () => {
      cancelled = true;
      stopPolling();
      if (playerRef.current) emitCheckpoint();
      destroyPlayer(playerRef.current ?? createdPlayer);
      playerRef.current = null;
      mountNode.replaceChildren();
    };
  }, [emitCheckpoint, initialSeekSeconds, playable, pollTime, retryKey, startPolling, stopPolling, title, videoId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopPolling();
        emitCheckpoint();
      } else if (readPlayerState(playerRef.current) === 1) {
        startPolling();
      }
    };
    const handlePageHide = () => {
      stopPolling();
      emitCheckpoint();
    };
    const handlePageShow = () => {
      if (readPlayerState(playerRef.current) === 1) startPolling();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [emitCheckpoint, startPolling, stopPolling]);

  return (
    <div className="min-w-0">
      <div
        ref={frameRef}
        data-fullscreen-active={fullscreenActive ? "true" : "false"}
        className={`w-full overflow-hidden bg-[#0c1713] ring-1 ring-black/10 ${
          fullscreenActive
            ? "fixed inset-0 z-[100] h-[100dvh] min-h-0 rounded-none"
            : "relative aspect-video min-h-[200px] rounded-md"
        }`}
      >
        <div ref={containerRef} className="h-full w-full" aria-label={`YouTube 影片：${title}`} />
        {captionText ? (
          <div
            aria-hidden="true"
            data-caption-overlay="true"
            className="pointer-events-none absolute inset-x-3 z-10 flex justify-center sm:inset-x-8"
            style={{
              bottom: fullscreenActive
                ? "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)"
                : "4.25rem"
            }}
          >
            <p className="max-w-3xl rounded bg-black/85 px-3 py-1.5 text-center text-sm font-semibold leading-6 text-white shadow-sm sm:text-base">
              {captionText}
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void handleFullscreenToggle()}
          aria-label={fullscreenActive ? "離開影片與字幕全螢幕" : "影片與字幕全螢幕"}
          aria-pressed={fullscreenActive}
          title={fullscreenActive ? "離開全螢幕" : "影片與字幕全螢幕"}
          className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-md bg-black/80 text-white shadow-sm transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none"
        >
          {fullscreenActive ? (
            <Minimize2 aria-hidden="true" size={19} strokeWidth={2} />
          ) : (
            <Maximize2 aria-hidden="true" size={19} strokeWidth={2} />
          )}
        </button>
      </div>
      <div className="mt-3 flex min-h-6 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 text-xs font-semibold text-[var(--ink-soft)]">
        <span aria-live="polite">{getStateLabel(state)}</span>
        <span className="font-mono tabular-nums">{timeLabel}</span>
      </div>
      {error ? (
        <div className="mt-3 flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-6">
            {error.message}（錯誤碼 {error.code}）。若播放器仍無法載入，請改在 YouTube 開啟。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRetryKey((current) => current + 1)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-amber-300 bg-white/70 px-3 py-2 text-sm font-bold hover:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              <RotateCcw aria-hidden="true" size={16} strokeWidth={2} />
              重試
            </button>
            <a
              href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[var(--brand-deep)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--brand-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)] focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              在 YouTube 開啟
              <ExternalLink aria-hidden="true" size={16} strokeWidth={2} />
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
});

function formatPlayerTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function getYouTubeErrorMessage(code: number) {
  if (code === 100) return "找不到這支影片";
  if (code === 101 || code === 150) return "這支影片目前不允許在外部網站嵌入播放";
  if (code === 153) return "YouTube 沒有收到有效的播放器來源資訊";
  return "YouTube 暫時無法播放這支影片";
}
