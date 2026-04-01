import { describe, it, expect } from "vitest";
import {
  spawnParticles,
  advanceParticles,
  lerp,
  type Particle,
  type EdgeEndpoints,
} from "./edge-particles";

// ── helpers ──

const edges: EdgeEndpoints[] = [
  { sourceId: "A", targetId: "B" },
  { sourceId: "C", targetId: "A" },
  { sourceId: "D", targetId: "E" },
];

function alwaysSpawn(_i: number) {
  return 0.1; // < 0.4 threshold → always spawn
}
function neverSpawn(_i: number) {
  return 0.9; // > 0.4 threshold → never spawn
}

// ── spawnParticles ──

describe("spawnParticles", () => {
  it("spawns on edges connected to activeId", () => {
    const spawned = spawnParticles(edges, "A", [], 200, alwaysSpawn);
    // edges[0] A→B and edges[1] C→A are connected to A; edges[2] is not
    expect(spawned).toHaveLength(2);
    expect(spawned[0].linkIdx).toBe(0);
    expect(spawned[1].linkIdx).toBe(1);
  });

  it("sets direction outward from activeId (source match → t=0, forward)", () => {
    const spawned = spawnParticles(edges, "A", [], 200, alwaysSpawn);
    // edges[0]: source=A → fromSource=true → t=0, speed>0
    expect(spawned[0].t).toBe(0);
    expect(spawned[0].speed).toBeGreaterThan(0);
  });

  it("sets direction inward when activeId is target (t=1, reverse)", () => {
    const spawned = spawnParticles(edges, "A", [], 200, alwaysSpawn);
    // edges[1]: source=C, target=A → fromSource=false → t=1, speed<0
    expect(spawned[1].t).toBe(1);
    expect(spawned[1].speed).toBeLessThan(0);
  });

  it("respects roll threshold — skips when roll > 0.4", () => {
    const spawned = spawnParticles(edges, "A", [], 200, neverSpawn);
    expect(spawned).toHaveLength(0);
  });

  it("respects maxParticles cap", () => {
    const existingPool: Particle[] = Array.from({ length: 199 }, () => ({
      linkIdx: 0,
      t: 0.5,
      speed: 1,
    }));
    const spawned = spawnParticles(edges, "A", existingPool, 200, alwaysSpawn);
    // Only 1 slot left (200 - 199)
    expect(spawned).toHaveLength(1);
  });

  it("returns empty when no edges connect to activeId", () => {
    const spawned = spawnParticles(edges, "Z", [], 200, alwaysSpawn);
    expect(spawned).toHaveLength(0);
  });
});

// ── advanceParticles ──

describe("advanceParticles", () => {
  it("advances t by speed * delta", () => {
    const pool: Particle[] = [{ linkIdx: 0, t: 0.2, speed: 1.0 }];
    advanceParticles(pool, 0.1);
    expect(pool[0].t).toBeCloseTo(0.3);
  });

  it("removes particles that exceed t=1", () => {
    const pool: Particle[] = [{ linkIdx: 0, t: 0.95, speed: 1.0 }];
    const alive = advanceParticles(pool, 0.1); // t → 1.05
    expect(alive).toBe(0);
    expect(pool).toHaveLength(0);
  });

  it("removes particles that go below t=0", () => {
    const pool: Particle[] = [{ linkIdx: 0, t: 0.05, speed: -1.0 }];
    const alive = advanceParticles(pool, 0.1); // t → -0.05
    expect(alive).toBe(0);
  });

  it("compacts the pool, preserving alive particles", () => {
    const pool: Particle[] = [
      { linkIdx: 0, t: 0.99, speed: 1.0 }, // will expire
      { linkIdx: 1, t: 0.5, speed: 0.1 },  // survives
      { linkIdx: 2, t: 0.01, speed: -1.0 }, // will expire
      { linkIdx: 3, t: 0.3, speed: 0.2 },  // survives
    ];
    const alive = advanceParticles(pool, 0.1);
    expect(alive).toBe(2);
    expect(pool).toHaveLength(2);
    expect(pool[0].linkIdx).toBe(1);
    expect(pool[1].linkIdx).toBe(3);
  });

  it("handles empty pool", () => {
    const pool: Particle[] = [];
    expect(advanceParticles(pool, 0.1)).toBe(0);
  });
});

// ── lerp ──

describe("lerp", () => {
  it("returns a at t=0", () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it("returns b at t=1", () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it("returns midpoint at t=0.5", () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });
});
