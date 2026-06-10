import { describe, it, expect } from "vitest";
import {
  calculateEngagement,
  calculateClusterEngagement,
  RECIPROCITY_WEIGHT,
} from "./engagement";
import { INTERACTION_WEIGHTS } from "./interaction-cluster";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { Cluster } from "@/domain/entities/cluster";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

let counter = 0;
function ev(pubkey: string, kind: number, tags: string[][] = []): NostrEvent {
  return {
    id: `ev-${counter++}`,
    pubkey,
    created_at: 1000,
    kind,
    tags,
    content: "x",
    sig: "",
  };
}

const note = (pk: string) => ev(pk, NOSTR_KIND.TEXT_NOTE);
// NIP-10 reply: the e-tag pubkey hint must be 64-hex to resolve, so reply
// targets in these tests use 64-char hex pubkeys
const hex = (c: string) => c.repeat(64);
const reply = (pk: string, toHex: string) =>
  ev(pk, NOSTR_KIND.TEXT_NOTE, [["e", "some-id", "", "reply", toHex], ["p", toHex]]);
const mention = (pk: string, to: string) =>
  ev(pk, NOSTR_KIND.TEXT_NOTE, [["p", to]]);
const reaction = (pk: string, to: string) =>
  ev(pk, NOSTR_KIND.REACTION, [["p", to]]);
const repost = (pk: string, to: string) =>
  ev(pk, NOSTR_KIND.REPOST, [["p", to]]);
const zap = (sender: string, to: string) =>
  ev("lnurl-server", NOSTR_KIND.ZAP_RECEIPT, [["p", to], ["P", sender.padEnd(64, "0")]]);

describe("calculateEngagement", () => {
  it("score composition is verifiable from the metrics breakdown", () => {
    const events = [
      note("alice"),
      reaction("bob", "alice"),
      reaction("carol", "alice"),
      repost("bob", "alice"),
      mention("dave", "alice"),
    ];
    const { metrics } = calculateEngagement(events);
    const m = metrics.get("alice")!;
    expect(m.reactionsReceived).toBe(2);
    expect(m.repostsReceived).toBe(1);
    expect(m.mentionsReceived).toBe(1);
    expect(m.inboundPartners).toBe(3); // bob, carol, dave
    expect(m.reciprocalPartners).toBe(0);
    // receivedScore recomputable from the breakdown — no hidden terms
    const expected =
      2 * INTERACTION_WEIGHTS.reaction +
      1 * INTERACTION_WEIGHTS.repost +
      1 * INTERACTION_WEIGHTS.mention;
    expect(m.receivedScore).toBeCloseTo(expected, 10);
    expect(m.score).toBeCloseTo(expected, 10); // no reciprocity here
  });

  it("spam earns nothing: mass posting + mass mentioning scores 0", () => {
    const events: NostrEvent[] = [];
    for (let i = 0; i < 50; i++) events.push(note("spammer"));
    for (let i = 0; i < 30; i++) events.push(mention("spammer", `victim${i}`));
    const { scores, metrics } = calculateEngagement(events);
    expect(scores["spammer"]).toBe(0);
    // mention notes are notes too: 50 + 30
    expect(metrics.get("spammer")!.noteCount).toBe(80);
  });

  it("influencers rank high: received zaps/replies dominate", () => {
    const influencer = hex("1");
    const events: NostrEvent[] = [
      note(influencer),
      note("normal"),
      zap("a", influencer),
      reply("b", influencer),
      reply("c", influencer),
      reaction("d", influencer),
      reaction("a", "normal"),
    ];
    const { scores } = calculateEngagement(events);
    expect(scores[influencer]).toBeGreaterThan(scores["normal"] * 3);
  });

  it("mutual conversation beats one-way of the same volume", () => {
    const oneTarget = hex("c");
    const aliceHex = hex("a");
    const bobHex = hex("b");
    // one-way: x sends 2 replies to oneTarget
    // mutual: alice and bob send 1 reply each to each other
    const events = [
      reply("x", oneTarget),
      reply("x", oneTarget),
      reply(aliceHex, bobHex),
      reply(bobHex, aliceHex),
    ];
    const { metrics } = calculateEngagement(events);
    const oneway = metrics.get(oneTarget)!;
    const alice = metrics.get(aliceHex)!;
    expect(oneway.receivedScore).toBe(2 * INTERACTION_WEIGHTS.reply);
    expect(alice.receivedScore).toBe(1 * INTERACTION_WEIGHTS.reply);
    expect(alice.reciprocalPartners).toBe(1);
    // reciprocity bonus puts the mutual chatter ahead per unit received
    expect(alice.score).toBe(
      INTERACTION_WEIGHTS.reply + RECIPROCITY_WEIGHT,
    );
    expect(oneway.reciprocalPartners).toBe(0);
  });

  it("counts followers separately (not in the score)", () => {
    const contacts = ev("fan", NOSTR_KIND.CONTACT_LIST, [["p", "alice"]]);
    const { metrics, scores } = calculateEngagement([note("alice"), contacts]);
    expect(metrics.get("alice")!.followerCount).toBe(1);
    expect(scores["alice"]).toBe(0); // follow weight is 0 by policy
  });

  it("returns empty for no events", () => {
    const { scores, metrics } = calculateEngagement([]);
    expect(Object.keys(scores)).toHaveLength(0);
    expect(metrics.size).toBe(0);
  });
});

describe("calculateClusterEngagement", () => {
  function cluster(id: string, members: string[]): Cluster {
    return {
      id,
      label: id,
      hashtags: [],
      memberPubkeys: new Set(members),
      color: "#fff",
    };
  }

  it("counts only engagement from same-cluster members", () => {
    const clusters = [
      cluster("c1", ["alice", "bob"]),
      cluster("c2", ["carol"]),
    ];
    const events = [
      reaction("bob", "alice"), // same cluster → counts
      reaction("carol", "alice"), // cross-cluster → ignored
      reaction("dave", "alice"), // unclustered → ignored
    ];
    const within = calculateClusterEngagement(events, clusters);
    expect(within.get("alice")).toBe(INTERACTION_WEIGHTS.reaction);
  });

  it("gives nothing to unclustered users", () => {
    const events = [reaction("bob", "alice")];
    const within = calculateClusterEngagement(events, []);
    expect(within.get("alice")).toBeUndefined();
  });
});
