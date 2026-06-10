"use client";

import { useMemo, useState, useCallback } from "react";
import { useClusterTimeline } from "@/presentation/hooks/useClusterDetection";
import { useSortedClusters } from "@/presentation/hooks/useSortedClusters";
import { useActivityStore } from "@/store/activity-store";
import { useEventStore } from "@/store/event-store";
import { useUIStore } from "@/store/ui-store";
import type { Cluster } from "@/domain/entities/cluster";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { NostrProfile } from "@/domain/entities/nostr-profile";
import { filterByHashtag } from "@/domain/entities/nostr-event";
import {
  fetchOlderAuthorNotes,
  fetchRecentNotes,
  fetchProfiles,
} from "@/infra/nostr/event-fetcher";
import { NoteCard } from "./NoteCard";
import { Badge } from "@/components/ui/badge";
import { useNowSec } from "@/lib/use-now-sec";
import { TimelineScroller } from "@/presentation/components/common/TimelineScroller";

interface ClusterTimelineProps {
  clusterId: string | null;
}

export function ClusterTimeline({ clusterId }: ClusterTimelineProps) {
  const { clusters: sortedClusters } = useSortedClusters();
  const { events, cluster, profiles } = useClusterTimeline(clusterId);
  const lastPostTime = useActivityStore((s) => s.lastPostTime);
  const nowSec = useNowSec();

  // Which channels are "on air" (a member posted in the last 2h)
  const liveClusterIds = useMemo(() => {
    const twoHoursAgo = nowSec - 7200;
    const live = new Set<string>();
    for (const c of sortedClusters) {
      for (const pk of c.memberPubkeys) {
        const last = lastPostTime.get(pk);
        if (last && last > twoHoursAgo) {
          live.add(c.id);
          break;
        }
      }
    }
    return live;
  }, [sortedClusters, lastPostTime, nowSec]);

  const switchCluster = (id: string) => {
    useUIStore.getState().selectCluster(id);
    useUIStore.getState().flyToClusterFn?.(id);
  };

  // Channel up/down on the rail: ← → flip stations, Home/End jump
  const handleRailKeyDown = (e: React.KeyboardEvent) => {
    if (sortedClusters.length === 0) return;
    const idx = sortedClusters.findIndex((c) => c.id === clusterId);
    let next = -1;
    if (e.key === "ArrowRight") next = Math.min(idx + 1, sortedClusters.length - 1);
    else if (e.key === "ArrowLeft") next = Math.max(idx - 1, 0);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = sortedClusters.length - 1;
    else return;
    e.preventDefault();
    if (next !== idx && next >= 0) switchCluster(sortedClusters[next].id);
  };

  // Scroll the newly tuned-in chip into view. The active chip remounts
  // (its key changes), so this stable callback fires once per switch.
  const activeChipRef = useCallback((el: HTMLButtonElement | null) => {
    if (!el) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollIntoView({
      inline: "nearest",
      block: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Channel rail — station presets */}
      <nav
        role="tablist"
        aria-label="Cluster channels"
        tabIndex={0}
        onKeyDown={handleRailKeyDown}
        className="channel-rail flex gap-2 md:gap-1.5 px-3 py-2 overflow-x-auto overscroll-x-contain border-b border-[#00ff41]/10 snap-x snap-mandatory shrink-0 [touch-action:pan-x] outline-none focus-visible:ring-1 focus-visible:ring-[#00ff41]/30"
      >
        {sortedClusters.map((c) => {
          const isActive = c.id === clusterId;
          const isLive = liveClusterIds.has(c.id);
          return (
            <button
              key={isActive ? `${c.id}-active` : c.id}
              ref={isActive ? activeChipRef : undefined}
              role="tab"
              aria-selected={isActive}
              tabIndex={-1}
              onClick={() => switchCluster(c.id)}
              style={
                {
                  "--cluster": c.color,
                  ...(isActive
                    ? {
                        backgroundColor: c.color + "1f",
                        borderColor: c.color + "59",
                      }
                    : {}),
                } as React.CSSProperties
              }
              className={`group flex items-center gap-1.5 shrink-0 snap-start rounded px-2 py-1.5 md:py-1 min-h-[36px] md:min-h-[28px] border transition-colors duration-150 ${
                isActive
                  ? "ring-1 ring-inset"
                  : "border-[#00ff41]/10 bg-[#00ff41]/[0.02] hover:bg-[#00ff41]/[0.06] hover:border-[#00ff41]/20"
              }`}
            >
              <span
                className={`channel-dot w-1.5 h-1.5 rounded-sm shrink-0 ${isLive ? "channel-live" : ""}`}
                style={{ backgroundColor: c.color }}
              />
              <span
                className={`font-mono text-[10px] truncate ${
                  isActive
                    ? "font-medium max-w-[120px]"
                    : "text-[#00ff41]/45 group-hover:text-[#00ff41]/75 max-w-[92px]"
                }`}
                style={isActive ? { color: c.color } : undefined}
              >
                {c.label}
              </span>
            </button>
          );
        })}
      </nav>

      {cluster ? (
        <ChannelBody
          key={cluster.id}
          cluster={cluster}
          events={events}
          profiles={profiles}
          nowSec={nowSec}
        />
      ) : (
        <div className="flex items-center justify-center flex-1">
          <p className="font-mono text-[10px] text-[#00ff41]/25 uppercase tracking-wider">
            Select target cluster
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Keyed by cluster id: switching channels remounts this subtree, which
 * resets the hashtag filter + scroll position and replays the CSS enter
 * transition (channel-wash + color flash in the cluster's own color).
 */
function ChannelBody({
  cluster,
  events,
  profiles,
  nowSec,
}: {
  cluster: Cluster;
  events: NostrEvent[];
  profiles?: Map<string, NostrProfile>;
  nowSec: number;
}) {
  const lastPostTime = useActivityStore((s) => s.lastPostTime);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const activeCount = useMemo(() => {
    const twoHoursAgo = nowSec - 7200;
    let count = 0;
    for (const pk of cluster.memberPubkeys) {
      const last = lastPostTime.get(pk);
      if (last && last > twoHoursAgo) count++;
    }
    return count;
  }, [cluster, lastPostTime, nowSec]);

  const filteredEvents = useMemo(
    () => filterByHashtag(events, filterTag),
    [events, filterTag],
  );

  const handleTagClick = (tag: string) => {
    setFilterTag((prev) => {
      const next = prev === tag ? null : tag;
      setHasMore(true);
      return next;
    });
  };

  const handleRefresh = useCallback(async () => {
    const latest = events[0];
    const since = latest ? latest.created_at : Math.floor(Date.now() / 1000) - 300;
    const newEvents = await fetchRecentNotes(since, 200);
    if (newEvents.length > 0) {
      useEventStore.getState().addEvents(newEvents);
      const unknownPks = [
        ...new Set(
          newEvents.map((e) => e.pubkey).filter((pk) => !useEventStore.getState().profiles.has(pk)),
        ),
      ].slice(0, 50);
      if (unknownPks.length > 0) {
        const profileEvents = await fetchProfiles(unknownPks);
        useEventStore.getState().addEvents(profileEvents);
      }
    }
  }, [events]);

  const handleLoadOlder = useCallback(async () => {
    const oldest = filteredEvents.at(-1);
    if (!oldest) return;
    const pubkeys = [...cluster.memberPubkeys];
    const olderEvents = await fetchOlderAuthorNotes(pubkeys, oldest.created_at, 100);
    if (olderEvents.length === 0) {
      setHasMore(false);
      return;
    }
    useEventStore.getState().addEvents(olderEvents);
    const unknownPks = [
      ...new Set(
        olderEvents.map((e) => e.pubkey).filter((pk) => !useEventStore.getState().profiles.has(pk)),
      ),
    ].slice(0, 50);
    if (unknownPks.length > 0) {
      const profileEvents = await fetchProfiles(unknownPks);
      useEventStore.getState().addEvents(profileEvents);
    }
  }, [cluster, filteredEvents]);

  return (
    <div
      className="channel-enter relative flex flex-col flex-1 min-h-0"
      style={{ "--cluster": cluster.color } as React.CSSProperties}
    >
      <span className="channel-flash" aria-hidden />

      {/* Channel header: identity rule, headline, tagline, tags, vitals */}
      <header className="relative px-4 pt-3 pb-2.5 pl-5 border-b border-[#00ff41]/10 overflow-hidden shrink-0">
        <span
          aria-hidden
          className="absolute left-2 top-3 bottom-3 w-[3px] rounded-full"
          style={{ backgroundColor: cluster.color, opacity: 0.7 }}
        />

        <h2
          className="font-mono text-[15px] font-semibold leading-tight tracking-tight break-words"
          style={{ color: cluster.color }}
        >
          {cluster.label}
        </h2>

        {cluster.tagline && (
          <p className="font-mono text-[11px] text-[#00ff41]/55 leading-snug mt-1 line-clamp-2">
            {cluster.tagline}
          </p>
        )}

        {cluster.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {cluster.hashtags.slice(0, 4).map((tag) => {
              const isActive = filterTag === tag;
              return (
                <button key={tag} onClick={() => handleTagClick(tag)} className="py-1 md:py-0">
                  <Badge
                    variant="secondary"
                    className={`font-mono text-[9px] cursor-pointer transition-colors ${
                      isActive
                        ? "bg-[#00ff41]/20 text-[#00ff41] border-[#00ff41]/40"
                        : "bg-transparent text-[#00ff41]/40 border-[#00ff41]/10 hover:text-[#00ff41]/70 hover:bg-[#00ff41]/5"
                    }`}
                    style={{ borderColor: isActive ? undefined : cluster.color + "33" }}
                  >
                    #{tag}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 mt-2 font-mono text-[9px] uppercase tracking-[0.15em]">
          <span className="text-[#0ff]/30">
            {cluster.memberPubkeys.size} voices
          </span>
          <span className="text-white/15">·</span>
          <span
            className={
              activeCount > 0
                ? "inline-flex items-center gap-1 text-[#00ff41]/60"
                : "text-white/20"
            }
          >
            {activeCount > 0 && (
              <span className="w-1 h-1 rounded-full bg-[#00ff41] osint-pulse" />
            )}
            {activeCount} active now
          </span>
        </div>
      </header>

      <TimelineScroller
        onRefresh={handleRefresh}
        onLoadOlder={handleLoadOlder}
        hasMore={hasMore}
        className="px-3 py-2 space-y-2"
      >
        {filteredEvents.map((event) => (
          <NoteCard
            key={event.id}
            event={event}
            profile={profiles?.get(event.pubkey)}
            onHashtagClick={handleTagClick}
          />
        ))}
        {filteredEvents.length === 0 && (
          <p className="font-mono text-[10px] text-[#00ff41]/20 text-center py-8 uppercase tracking-wider">
            {filterTag ? "No signals match filter" : "No signals intercepted"}
          </p>
        )}
      </TimelineScroller>
    </div>
  );
}
