/**
 * Format a time offset relative to now as a human-readable label.
 * Returns "LIVE" when the end time is at or ahead of now.
 */
export function formatTimeOffset(nowSec: number, endSec: number): string {
  const diffMin = Math.round((nowSec - endSec) / 60);
  if (diffMin <= 0) return "LIVE";
  if (diffMin < 60) return `-${diffMin}m`;
  return `-${Math.floor(diffMin / 60)}h${diffMin % 60}m`;
}
