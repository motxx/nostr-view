"use client";

import { useMemo, useRef, useCallback, useSyncExternalStore } from "react";
import { useEventStore } from "@/store/event-store";
import { useUIStore } from "@/store/ui-store";
import { computeHistogram, type HistogramBucket } from "@/lib/event-histogram";

const WINDOW_HOURS = 2;
const WINDOW_SEC = WINDOW_HOURS * 60 * 60;
const BUCKET_SIZE_SEC = 300; // 5 minutes

/** Provides current time (unix seconds) that ticks every 30 seconds. */
let _nowSec = Math.floor(Date.now() / 1000);
const _listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  setInterval(() => {
    _nowSec = Math.floor(Date.now() / 1000);
    for (const l of _listeners) l();
  }, 30_000);
}
function subscribeNow(cb: () => void) {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}
function getNowSnapshot() { return _nowSec; }
function getNowServerSnapshot() { return 0; }

export function TimelineScrubber() {
  const eventsById = useEventStore((s) => s.eventsById);
  const isLive = useUIStore((s) => s.isLive);
  const timeRange = useUIStore((s) => s.timeRange);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to periodic ticks so nowSec refreshes
  const nowSec = useSyncExternalStore(subscribeNow, getNowSnapshot, getNowServerSnapshot);
  const windowStart = nowSec - WINDOW_SEC;

  const allEvents = useMemo(() => [...eventsById.values()], [eventsById]);

  const buckets = useMemo(
    () => computeHistogram(allEvents, windowStart, nowSec, BUCKET_SIZE_SEC),
    [allEvents, windowStart, nowSec],
  );

  const maxCount = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.count)),
    [buckets],
  );

  // Current slider position as fraction 0-1
  const sliderValue = useMemo(() => {
    if (isLive || !timeRange) return 1;
    const frac = (timeRange[1] - windowStart) / WINDOW_SEC;
    return Math.max(0, Math.min(1, frac));
  }, [isLive, timeRange, windowStart]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const frac = parseFloat(e.target.value);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (frac >= 0.99) {
        debounceRef.current = setTimeout(() => {
          useUIStore.getState().goLive();
        }, 300);
        return;
      }

      debounceRef.current = setTimeout(() => {
        const endSec = windowStart + frac * WINDOW_SEC;
        const startSec = endSec - BUCKET_SIZE_SEC * 2; // ~10 minute window
        useUIStore.getState().setTimeRange([
          Math.max(windowStart, startSec),
          endSec,
        ]);
      }, 300);
    },
    [windowStart],
  );

  const handleGoLive = useCallback(() => {
    useUIStore.getState().goLive();
  }, []);

  // Time label for current position
  const timeLabel = useMemo(() => {
    if (isLive) return "LIVE";
    if (!timeRange) return "LIVE";
    const diffMin = Math.round((nowSec - timeRange[1]) / 60);
    if (diffMin <= 0) return "LIVE";
    if (diffMin < 60) return `-${diffMin}m`;
    return `-${Math.round(diffMin / 60)}h${diffMin % 60}m`;
  }, [isLive, timeRange, nowSec]);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
      <div className="flex items-end gap-2 bg-black/80 backdrop-blur-sm border border-[#00ff41]/15 rounded-lg px-3 py-2">
        {/* Histogram bars */}
        <div className="flex items-end gap-px h-6">
          {buckets.map((bucket, i) => (
            <HistogramBar
              key={i}
              bucket={bucket}
              maxCount={maxCount}
              isInRange={isInTimeRange(bucket, timeRange, isLive)}
            />
          ))}
        </div>

        {/* Slider */}
        <div className="flex flex-col items-center gap-0.5 min-w-[120px]">
          <input
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={sliderValue}
            onChange={handleSliderChange}
            className="w-full h-1 appearance-none bg-[#00ff41]/10 rounded-full cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:bg-[#00ff41] [&::-webkit-slider-thumb]:rounded-sm
              [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <span className="font-mono text-[9px] text-[#00ff41]/50 tabular-nums">
            {timeLabel}
          </span>
        </div>

        {/* LIVE button */}
        <button
          onClick={handleGoLive}
          className={`font-mono text-[9px] px-2 py-0.5 rounded border transition-colors uppercase tracking-wider ${
            isLive
              ? "text-[#00ff41] border-[#00ff41]/30 bg-[#00ff41]/10"
              : "text-[#00ff41]/30 border-[#00ff41]/10 hover:text-[#00ff41]/60 hover:bg-[#00ff41]/5"
          }`}
        >
          live
        </button>
      </div>
    </div>
  );
}

function HistogramBar({
  bucket,
  maxCount,
  isInRange,
}: {
  bucket: HistogramBucket;
  maxCount: number;
  isInRange: boolean;
}) {
  const height = bucket.count > 0 ? Math.max(2, (bucket.count / maxCount) * 24) : 1;
  return (
    <div
      className="w-1 rounded-t-sm transition-all duration-200"
      style={{
        height: `${height}px`,
        backgroundColor: isInRange
          ? "rgba(0,255,65,0.5)"
          : "rgba(0,255,65,0.12)",
      }}
    />
  );
}

function isInTimeRange(
  bucket: HistogramBucket,
  timeRange: [number, number] | null,
  isLive: boolean,
): boolean {
  if (isLive || !timeRange) return true;
  return bucket.start < timeRange[1] && bucket.end > timeRange[0];
}
