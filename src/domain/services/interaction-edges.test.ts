import { describe, it, expect } from "vitest";
import {
  extractInteractionEdges,
  extractAllInteractionEdges,
  buildAuthorIndex,
} from "./interaction-edges";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

const HEX_A = "a".repeat(64);
const HEX_B = "b".repeat(64);

let counter = 0;
function ev(
  pubkey: string,
  kind: number,
  tags: string[][],
  id?: string,
): NostrEvent {
  return {
    id: id ?? `ev-${counter++}`,
    pubkey,
    created_at: 1000,
    kind,
    tags,
    content: "",
    sig: "",
  };
}

describe("kind-1 text notes (NIP-10)", () => {
  it("marked reply e-tag wins; ancestor p-tags become mentions", () => {
    // carol replies to bob in a thread rooted by alice
    const root = ev("alice", NOSTR_KIND.TEXT_NOTE, [], "root-id");
    const parent = ev("bob", NOSTR_KIND.TEXT_NOTE, [], "parent-id");
    const reply = ev("carol", NOSTR_KIND.TEXT_NOTE, [
      ["e", "root-id", "", "root"],
      ["e", "parent-id", "", "reply"],
      ["p", "alice"], // ancestor chain copied per NIP-10
      ["p", "bob"],
    ]);
    const edges = extractAllInteractionEdges([root, parent, reply]);
    const fromCarol = edges.filter((e) => e.source === "carol");
    expect(fromCarol).toContainEqual({
      source: "carol",
      target: "bob",
      type: "reply",
    });
    expect(fromCarol).toContainEqual({
      source: "carol",
      target: "alice",
      type: "mention",
    });
    expect(fromCarol).toHaveLength(2);
  });

  it("direct reply to root uses the root-marked tag", () => {
    const root = ev("alice", NOSTR_KIND.TEXT_NOTE, [], "root-id");
    const reply = ev("bob", NOSTR_KIND.TEXT_NOTE, [
      ["e", "root-id", "", "root"],
      ["p", "alice"],
    ]);
    const edges = extractAllInteractionEdges([root, reply]);
    expect(edges).toContainEqual({
      source: "bob",
      target: "alice",
      type: "reply",
    });
  });

  it("positional fallback: last e-tag is the parent (deprecated NIP-10)", () => {
    const root = ev("alice", NOSTR_KIND.TEXT_NOTE, [], "root-id");
    const parent = ev("bob", NOSTR_KIND.TEXT_NOTE, [], "parent-id");
    const reply = ev("carol", NOSTR_KIND.TEXT_NOTE, [
      ["e", "root-id"],
      ["e", "parent-id"],
      ["p", "alice"],
      ["p", "bob"],
    ]);
    const edges = extractInteractionEdges(reply, buildAuthorIndex([root, parent]));
    expect(edges).toContainEqual({
      source: "carol",
      target: "bob",
      type: "reply",
    });
    expect(edges).toContainEqual({
      source: "carol",
      target: "alice",
      type: "mention",
    });
  });

  it("resolves reply author from the e-tag pubkey hint without the parent event", () => {
    const reply = ev("carol", NOSTR_KIND.TEXT_NOTE, [
      ["e", "unknown-id", "", "reply", HEX_A],
    ]);
    const edges = extractInteractionEdges(reply, new Map());
    expect(edges).toEqual([
      { source: "carol", target: HEX_A, type: "reply" },
    ]);
  });

  it("p-tags without any e-tag are pure mentions", () => {
    const note = ev("alice", NOSTR_KIND.TEXT_NOTE, [["p", "bob"]]);
    const edges = extractInteractionEdges(note, new Map());
    expect(edges).toEqual([
      { source: "alice", target: "bob", type: "mention" },
    ]);
  });

  it("q tags produce quote edges using the pubkey hint (NIP-18)", () => {
    const note = ev("alice", NOSTR_KIND.TEXT_NOTE, [
      ["q", "quoted-id", "", HEX_B],
    ]);
    const edges = extractInteractionEdges(note, new Map());
    expect(edges).toEqual([
      { source: "alice", target: HEX_B, type: "quote" },
    ]);
  });

  it("drops self-references", () => {
    const note = ev("alice", NOSTR_KIND.TEXT_NOTE, [["p", "alice"]]);
    expect(extractInteractionEdges(note, new Map())).toEqual([]);
  });

  it("deduplicates repeated p-tags within one event", () => {
    const note = ev("alice", NOSTR_KIND.TEXT_NOTE, [
      ["p", "bob"],
      ["p", "bob"],
    ]);
    expect(extractInteractionEdges(note, new Map())).toHaveLength(1);
  });
});

describe("kind-7 reactions (NIP-25)", () => {
  it("uses only the LAST p-tag (earlier ones are copied ancestors)", () => {
    const reaction = ev("dave", NOSTR_KIND.REACTION, [
      ["p", "alice"],
      ["p", "bob"],
      ["p", "carol"],
    ]);
    const edges = extractInteractionEdges(reaction, new Map());
    expect(edges).toEqual([
      { source: "dave", target: "carol", type: "reaction" },
    ]);
  });

  it("falls back to e-tag author resolution when no p-tag", () => {
    const note = ev("alice", NOSTR_KIND.TEXT_NOTE, [], "note-id");
    const reaction = ev("dave", NOSTR_KIND.REACTION, [["e", "note-id"]]);
    const edges = extractInteractionEdges(reaction, buildAuthorIndex([note]));
    expect(edges).toEqual([
      { source: "dave", target: "alice", type: "reaction" },
    ]);
  });
});

describe("kind-6 reposts", () => {
  it("targets the original author via p-tag", () => {
    const repost = ev("dave", NOSTR_KIND.REPOST, [
      ["e", "note-id"],
      ["p", "alice"],
    ]);
    const edges = extractInteractionEdges(repost, new Map());
    expect(edges).toEqual([
      { source: "dave", target: "alice", type: "repost" },
    ]);
  });
});

describe("kind-9735 zap receipts (NIP-57)", () => {
  it("uses the P tag as sender when present", () => {
    const zap = ev("lnurl-server", NOSTR_KIND.ZAP_RECEIPT, [
      ["p", "alice"],
      ["P", HEX_B],
      ["bolt11", "lnbc10n1..."],
    ]);
    const edges = extractInteractionEdges(zap, new Map());
    expect(edges).toEqual([{ source: HEX_B, target: "alice", type: "zap" }]);
  });

  it("falls back to the zap request pubkey in description", () => {
    const zap = ev("lnurl-server", NOSTR_KIND.ZAP_RECEIPT, [
      ["p", "alice"],
      ["description", JSON.stringify({ kind: 9734, pubkey: HEX_A })],
    ]);
    const edges = extractInteractionEdges(zap, new Map());
    expect(edges).toEqual([{ source: HEX_A, target: "alice", type: "zap" }]);
  });

  it("skips malformed description JSON", () => {
    const zap = ev("lnurl-server", NOSTR_KIND.ZAP_RECEIPT, [
      ["p", "alice"],
      ["description", "{not json"],
    ]);
    expect(extractInteractionEdges(zap, new Map())).toEqual([]);
  });

  it("note: the receipt publisher (lnurl server) is never the edge source", () => {
    const zap = ev("lnurl-server", NOSTR_KIND.ZAP_RECEIPT, [
      ["p", "alice"],
      ["P", HEX_B],
    ]);
    const edges = extractInteractionEdges(zap, new Map());
    expect(edges[0].source).not.toBe("lnurl-server");
  });
});

describe("kind-3 contact lists", () => {
  it("produces follow edges for each p-tag", () => {
    const contacts = ev("alice", NOSTR_KIND.CONTACT_LIST, [
      ["p", "bob"],
      ["p", "carol"],
    ]);
    const edges = extractInteractionEdges(contacts, new Map());
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.type === "follow")).toBe(true);
  });
});

describe("unknown kinds", () => {
  it("returns no edges", () => {
    const metadata = ev("alice", NOSTR_KIND.METADATA, [["p", "bob"]]);
    expect(extractInteractionEdges(metadata, new Map())).toEqual([]);
  });
});
