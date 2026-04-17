"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

interface TimelineScrollerProps {
  onRefresh: () => Promise<void>;
  onLoadOlder: () => Promise<void>;
  hasMore?: boolean;
  children: ReactNode;
  className?: string;
}

const PULL_THRESHOLD = 60;

export function TimelineScroller({
  onRefresh,
  onLoadOlder,
  hasMore = true,
  children,
  className,
}: TimelineScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // ── Pull-to-refresh (pull down at top) ──
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = 0;
    }
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === 0 || refreshing) return;
      const el = scrollRef.current;
      if (!el || el.scrollTop > 0) return;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0) {
        setPullDistance(Math.min(dy * 0.5, PULL_THRESHOLD * 1.5));
      }
    },
    [refreshing],
  );

  const onTouchEnd = useCallback(async () => {
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
    touchStartY.current = 0;
  }, [pullDistance, refreshing, onRefresh]);

  // ── Load older (scroll to bottom) ──
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingOlder) {
          setLoadingOlder(true);
          onLoadOlder().finally(() => setLoadingOlder(false));
        }
      },
      { root: scrollRef.current, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingOlder, onLoadOlder]);

  return (
    <div
      ref={scrollRef}
      className={`flex-1 overflow-y-auto osint-scroll ${className ?? ""}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: refreshing ? 36 : pullDistance > 0 ? pullDistance : 0 }}
      >
        <span
          className={`font-mono text-[10px] uppercase tracking-wider ${
            refreshing
              ? "text-[#00ff41]/60 animate-pulse"
              : pullDistance >= PULL_THRESHOLD
                ? "text-[#00ff41]/60"
                : "text-[#00ff41]/25"
          }`}
        >
          {refreshing
            ? "syncing..."
            : pullDistance >= PULL_THRESHOLD
              ? "release to refresh"
              : "↓ pull to refresh"}
        </span>
      </div>

      {children}

      {/* Bottom sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          <span className="font-mono text-[10px] text-[#00ff41]/25 uppercase tracking-wider">
            {loadingOlder ? "loading older signals..." : ""}
          </span>
        </div>
      )}
    </div>
  );
}
