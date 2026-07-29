"use client";

import * as React from "react";
import {
  Captions,
  CaptionsOff,
  Gauge,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Modern lesson video player: custom controls (seek, speed, volume, fullscreen,
 * subtitle), resume from a saved position, auto-save watch progress, and — when
 * a lesson requires it — anti-skip enforcement (the learner cannot seek past the
 * furthest point they have actually watched).
 */
export function VideoPlayer({
  src,
  poster,
  subtitleUrl,
  startSeconds = 0,
  requireFullWatch = false,
  onProgress,
  onVideoComplete,
  onEnded,
}: {
  src: string;
  poster?: string | null;
  subtitleUrl?: string | null;
  startSeconds?: number;
  requireFullWatch?: boolean;
  onProgress?: (seconds: number) => void;
  onVideoComplete?: () => void;
  onEnded?: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const maxWatchedRef = React.useRef(startSeconds);
  const lastSaveRef = React.useRef(0);
  const completedRef = React.useRef(false);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = React.useState(false);
  const [buffering, setBuffering] = React.useState(false);
  const [cur, setCur] = React.useState(0);
  const [dur, setDur] = React.useState(0);
  const [buffered, setBuffered] = React.useState(0);
  const [maxWatched, setMaxWatched] = React.useState(startSeconds); // mirrors the ref for the anti-skip marker
  const [muted, setMuted] = React.useState(false);
  const [volume, setVolume] = React.useState(1);
  const [rate, setRate] = React.useState(1);
  const [rateOpen, setRateOpen] = React.useState(false);
  const [fs, setFs] = React.useState(false);
  const [cc, setCc] = React.useState(false);
  const [showControls, setShowControls] = React.useState(true);

  const kick = React.useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2600);
  }, []);

  const togglePlay = React.useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const seekTo = React.useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v) return;
      let target = Math.max(0, Math.min(t, v.duration || t));
      if (requireFullWatch) target = Math.min(target, maxWatchedRef.current + 1); // anti-skip
      v.currentTime = target;
      setCur(target);
    },
    [requireFullWatch],
  );

  const onTime = () => {
    const v = videoRef.current;
    if (!v) return;
    setCur(v.currentTime);
    if (v.currentTime > maxWatchedRef.current) {
      maxWatchedRef.current = v.currentTime;
      if (requireFullWatch) setMaxWatched(v.currentTime);
    }
    if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    const now = Date.now();
    if (now - lastSaveRef.current > 10000) {
      lastSaveRef.current = now;
      onProgress?.(v.currentTime);
    }
    if (!completedRef.current && v.duration && v.currentTime / v.duration >= 0.98) {
      completedRef.current = true;
      onVideoComplete?.();
    }
  };

  // Fullscreen state sync.
  React.useEffect(() => {
    const onFs = () => setFs(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen().catch(() => {});
  };

  const toggleCc = () => {
    const v = videoRef.current;
    if (!v?.textTracks?.length) return;
    const next = !cc;
    v.textTracks[0].mode = next ? "showing" : "hidden";
    setCc(next);
  };

  // Keyboard shortcuts when the player is focused/hovered.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowRight") {
      seekTo(cur + 5);
    } else if (e.key === "ArrowLeft") {
      seekTo(cur - 5);
    } else if (e.key.toLowerCase() === "f") {
      toggleFs();
    } else if (e.key.toLowerCase() === "m") {
      const v = videoRef.current;
      if (v) {
        v.muted = !v.muted;
        setMuted(v.muted);
      }
    }
    kick();
  };

  const pct = dur ? (cur / dur) * 100 : 0;
  const bufPct = dur ? (buffered / dur) * 100 : 0;

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseMove={kick}
      onMouseLeave={() => playing && setShowControls(false)}
      className={cn("group relative w-full select-none overflow-hidden rounded-xl bg-black outline-none", fs ? "h-full" : "aspect-video")}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        {...(subtitleUrl ? { crossOrigin: "anonymous" as const } : {})}
        playsInline
        onContextMenu={(e) => e.preventDefault()}
        onClick={togglePlay}
        onDoubleClick={toggleFs}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDur(v.duration);
          if (startSeconds > 0 && startSeconds < v.duration - 1) {
            v.currentTime = startSeconds;
            maxWatchedRef.current = startSeconds;
          }
          if (subtitleUrl && v.textTracks.length) v.textTracks[0].mode = "hidden";
        }}
        onPlay={() => {
          setPlaying(true);
          kick();
        }}
        onPause={() => {
          setPlaying(false);
          setShowControls(true);
          onProgress?.(videoRef.current?.currentTime ?? 0);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onTimeUpdate={onTime}
        onEnded={() => {
          setPlaying(false);
          completedRef.current = true;
          onVideoComplete?.();
          onProgress?.(videoRef.current?.duration ?? 0);
          onEnded?.();
        }}
        className="h-full w-full bg-black"
      >
        {subtitleUrl && <track kind="subtitles" src={subtitleUrl} srcLang="id" label="Indonesia" />}
      </video>

      {/* Buffering spinner */}
      {buffering && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="size-10 animate-spin text-white/90" />
        </div>
      )}

      {/* Center play button when paused */}
      {!playing && !buffering && (
        <button type="button" onClick={togglePlay} className="absolute inset-0 grid place-items-center" aria-label="Putar">
          <span className="grid size-16 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:scale-105 hover:bg-black/70">
            <Play className="size-8 translate-x-0.5" fill="currentColor" />
          </span>
        </button>
      )}

      {/* Controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3 pb-2 pt-8 transition-opacity duration-200",
          showControls || !playing ? "opacity-100" : "opacity-0",
        )}
      >
        {/* Seek bar */}
        <SeekBar pct={pct} bufPct={bufPct} onSeek={(f) => seekTo(f * (dur || 0))} disabledAhead={requireFullWatch ? (maxWatched + 1) / (dur || 1) : 1} />

        <div className="mt-1.5 flex items-center gap-2 text-white">
          <button type="button" onClick={togglePlay} className="grid size-8 place-items-center rounded hover:bg-white/15" aria-label={playing ? "Jeda" : "Putar"}>
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button type="button" onClick={() => seekTo(0)} className="grid size-8 place-items-center rounded hover:bg-white/15" aria-label="Ulang">
            <RotateCcw className="size-4" />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                v.muted = !v.muted;
                setMuted(v.muted);
              }}
              className="grid size-8 place-items-center rounded hover:bg-white/15"
              aria-label="Volume"
            >
              {muted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                const vol = Number(e.target.value);
                v.volume = vol;
                v.muted = vol === 0;
                setVolume(vol);
                setMuted(vol === 0);
              }}
              className="hidden h-1 w-16 cursor-pointer accent-white sm:block"
            />
          </div>

          <span className="ml-1 text-xs tabular-nums text-white/90">{fmt(cur)} / {fmt(dur)}</span>

          <div className="ml-auto flex items-center gap-1">
            {/* Speed */}
            <div className="relative">
              <button type="button" onClick={() => setRateOpen((o) => !o)} className="flex h-8 items-center gap-1 rounded px-2 text-xs hover:bg-white/15" aria-label="Kecepatan">
                <Gauge className="size-4" /> {rate}×
              </button>
              {rateOpen && (
                <div className="absolute bottom-9 right-0 z-10 w-20 overflow-hidden rounded-lg bg-black/90 py-1 text-xs text-white shadow-lg ring-1 ring-white/10">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        const v = videoRef.current;
                        if (v) v.playbackRate = s;
                        setRate(s);
                        setRateOpen(false);
                      }}
                      className={cn("block w-full px-3 py-1 text-left hover:bg-white/15", s === rate && "text-brand-400")}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              )}
            </div>

            {subtitleUrl && (
              <button type="button" onClick={toggleCc} className="grid size-8 place-items-center rounded hover:bg-white/15" aria-label="Subtitle">
                {cc ? <Captions className="size-5 text-brand-400" /> : <CaptionsOff className="size-5" />}
              </button>
            )}

            <button type="button" onClick={toggleFs} className="grid size-8 place-items-center rounded hover:bg-white/15" aria-label="Layar penuh">
              {fs ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The seek bar — click/drag to seek; a subtle marker shows the anti-skip limit. */
function SeekBar({ pct, bufPct, onSeek, disabledAhead }: { pct: number; bufPct: number; onSeek: (fraction: number) => void; disabledAhead: number }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const seekAt = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  };
  return (
    <div
      ref={ref}
      onClick={(e) => seekAt(e.clientX)}
      className="group/seek relative h-3 cursor-pointer"
    >
      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/25">
        <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${bufPct}%` }} />
        {disabledAhead < 1 && <div className="absolute inset-y-0 bg-white/10" style={{ left: `${disabledAhead * 100}%`, right: 0 }} />}
        <div className="absolute inset-y-0 left-0 bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500 opacity-0 transition group-hover/seek:opacity-100" style={{ left: `${pct}%` }} />
    </div>
  );
}
