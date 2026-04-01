import { useSyncExternalStore } from "react";

/** Shared ticker — ticks every 30 seconds. */
let _nowSec = Math.floor(Date.now() / 1000);
const _listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  setInterval(() => {
    _nowSec = Math.floor(Date.now() / 1000);
    for (const l of _listeners) l();
  }, 30_000);
}

function subscribe(cb: () => void) {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}
function getSnapshot() { return _nowSec; }
function getServerSnapshot() { return Math.floor(Date.now() / 1000); }

/** Current unix seconds, ticks every 30s. Single shared timer across all consumers. */
export function useNowSec(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
