import type { NostrEvent } from "@/domain/entities/nostr-event";

export interface HistogramBucket {
  /** Start of this bucket (unix seconds) */
  start: number;
  /** End of this bucket (unix seconds) */
  end: number;
  /** Number of events in this bucket */
  count: number;
}

/**
 * Compute a histogram of events over time.
 * Divides the range [windowStart, windowEnd] into buckets of `bucketSizeSec` seconds.
 */
export function computeHistogram(
  events: NostrEvent[],
  windowStart: number,
  windowEnd: number,
  bucketSizeSec: number = 300,
): HistogramBucket[] {
  if (windowStart >= windowEnd || bucketSizeSec <= 0) return [];

  const bucketCount = Math.ceil((windowEnd - windowStart) / bucketSizeSec);
  const buckets: HistogramBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const start = windowStart + i * bucketSizeSec;
    const end = Math.min(start + bucketSizeSec, windowEnd);
    buckets.push({ start, end, count: 0 });
  }

  for (const ev of events) {
    if (ev.created_at < windowStart || ev.created_at >= windowEnd) continue;
    const idx = Math.floor((ev.created_at - windowStart) / bucketSizeSec);
    if (idx >= 0 && idx < buckets.length) {
      buckets[idx].count++;
    }
  }

  return buckets;
}

/**
 * Filter events to those within [start, end) time range (unix seconds).
 */
export function filterEventsByTimeRange(
  events: NostrEvent[],
  start: number,
  end: number,
): NostrEvent[] {
  return events.filter((ev) => ev.created_at >= start && ev.created_at < end);
}
