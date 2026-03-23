"use client";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 pointer-events-none">
      <div className="pointer-events-auto">
        <h1 className="text-lg font-mono font-bold tracking-wider text-white/90">
          NOSTR<span className="text-blue-400">::</span>UNIVERSE
        </h1>
      </div>
    </header>
  );
}
