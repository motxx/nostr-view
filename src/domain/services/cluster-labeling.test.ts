import { describe, it, expect } from "vitest";
import {
  rankTermsByCTfIdf,
  rankClusterHashtags,
} from "./cluster-labeling";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

function note(pubkey: string, hashtags: string[], id = ""): NostrEvent {
  return {
    id: id || `${pubkey}-${hashtags.join("-")}`,
    pubkey,
    created_at: 0,
    kind: NOSTR_KIND.TEXT_NOTE,
    tags: hashtags.map((t) => ["t", t]),
    content: "",
    sig: "",
  };
}

describe("rankTermsByCTfIdf", () => {
  it("ranks cluster-distinctive terms above globally common ones", () => {
    // "nostr" appears heavily in BOTH clusters; "bitcoin"/"art" are unique
    const counts = new Map<string, Map<string, number>>([
      [
        "c1",
        new Map([
          ["nostr", 10],
          ["bitcoin", 6],
        ]),
      ],
      [
        "c2",
        new Map([
          ["nostr", 10],
          ["art", 6],
        ]),
      ],
    ]);
    const ranked = rankTermsByCTfIdf(counts);
    expect(ranked.get("c1")![0]).toBe("bitcoin");
    expect(ranked.get("c2")![0]).toBe("art");
  });

  it("breaks weight ties alphabetically for determinism", () => {
    const counts = new Map<string, Map<string, number>>([
      [
        "c1",
        new Map([
          ["zeta", 3],
          ["alpha", 3],
        ]),
      ],
    ]);
    const ranked = rankTermsByCTfIdf(counts);
    expect(ranked.get("c1")).toEqual(["alpha", "zeta"]);
  });

  it("returns empty map for empty input", () => {
    expect(rankTermsByCTfIdf(new Map()).size).toBe(0);
  });

  it("handles a single cluster (every term gets same idf)", () => {
    const counts = new Map<string, Map<string, number>>([
      [
        "c1",
        new Map([
          ["frequent", 5],
          ["rare", 1],
        ]),
      ],
    ]);
    const ranked = rankTermsByCTfIdf(counts);
    // c-TF-IDF: rare term gets higher idf but much lower tf; frequent term
    // can still win — both must simply be present, frequent first here
    // because tf dominates: 5·log(1+6/5) > 1·log(1+6/1)
    expect(ranked.get("c1")).toContain("frequent");
    expect(ranked.get("c1")).toContain("rare");
  });
});

describe("rankClusterHashtags", () => {
  it("aggregates member hashtags and ranks per cluster", () => {
    const events = [
      note("alice", ["nostr", "bitcoin"]),
      note("alice", ["bitcoin"]),
      note("bob", ["nostr", "bitcoin"]),
      note("carol", ["nostr", "art"]),
      note("dave", ["art", "painting"]),
    ];
    const clusterMembers = new Map<string, Set<string>>([
      ["btc", new Set(["alice", "bob"])],
      ["art", new Set(["carol", "dave"])],
    ]);
    const ranked = rankClusterHashtags(clusterMembers, events);
    expect(ranked.get("btc")![0]).toBe("bitcoin");
    expect(ranked.get("art")![0]).toBe("art");
    // shared tag "nostr" must not be the top tag of either cluster
    expect(ranked.get("btc")![0]).not.toBe("nostr");
    expect(ranked.get("art")![0]).not.toBe("nostr");
  });

  it("ignores non-text-note events", () => {
    const reaction: NostrEvent = {
      id: "r1",
      pubkey: "alice",
      created_at: 0,
      kind: NOSTR_KIND.REACTION,
      tags: [["t", "spamtag"]],
      content: "+",
      sig: "",
    };
    const events = [note("alice", ["bitcoin"]), reaction];
    const ranked = rankClusterHashtags(
      new Map([["c1", new Set(["alice"])]]),
      events,
    );
    expect(ranked.get("c1")).toEqual(["bitcoin"]);
  });

  it("returns empty tag list for clusters whose members have no hashtags", () => {
    const events = [note("alice", [])];
    const ranked = rankClusterHashtags(
      new Map([["c1", new Set(["alice"])]]),
      events,
    );
    expect(ranked.get("c1")).toEqual([]);
  });
});
