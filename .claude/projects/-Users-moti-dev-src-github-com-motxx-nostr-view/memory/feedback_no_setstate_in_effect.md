---
name: No setState in useEffect
description: User strongly prefers avoiding useEffect + setState pattern, use useSyncExternalStore or compute during render instead
type: feedback
---

Never use useEffect + setState for derived data or subscriptions. Use useSyncExternalStore for external subscriptions (time, WebSocket, etc.) and useMemo/inline computation for derived state.

**Why:** This is a core principle from Dan Abramov's "You Might Not Need an Effect". The eslint-plugin-react-hooks now enforces this via `set-state-in-effect` rule. User is excited about this enforcement and wants it strictly followed.

**How to apply:** When writing React hooks that subscribe to external data, reach for `useSyncExternalStore` first. For derived state, compute during render with useMemo or inline. Never write `useEffect(() => { setState(...) }, [...])` patterns.
