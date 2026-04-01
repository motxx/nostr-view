import { describe, it, expect } from "vitest";
import {
  getHashtags,
  getReferencedPubkeys,
  getReferencedEventIds,
  filterByHashtag,
  type NostrEvent,
} from "./nostr-event";

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: "ev1",
    pubkey: "pk1",
    created_at: 1000,
    kind: 1,
    tags: [],
    content: "",
    sig: "sig",
    ...overrides,
  };
}

describe("getHashtags", () => {
  it("extracts hashtags from t-tags and lowercases", () => {
    const ev = makeEvent({
      tags: [
        ["t", "Bitcoin"],
        ["t", "nostr"],
        ["p", "pk2"],
      ],
    });
    expect(getHashtags(ev)).toEqual(["bitcoin", "nostr"]);
  });

  it("returns empty array when no t-tags", () => {
    expect(getHashtags(makeEvent())).toEqual([]);
  });
});

describe("filterByHashtag", () => {
  const evBitcoin = makeEvent({
    id: "ev-btc",
    tags: [["t", "bitcoin"]],
  });
  const evNostr = makeEvent({
    id: "ev-nostr",
    tags: [["t", "nostr"]],
  });
  const evBoth = makeEvent({
    id: "ev-both",
    tags: [
      ["t", "bitcoin"],
      ["t", "nostr"],
    ],
  });
  const evNone = makeEvent({ id: "ev-none" });
  const all = [evBitcoin, evNostr, evBoth, evNone];

  it("returns all events when tag is null", () => {
    expect(filterByHashtag(all, null)).toBe(all);
  });

  it("filters to events containing the tag", () => {
    expect(filterByHashtag(all, "bitcoin")).toEqual([evBitcoin, evBoth]);
  });

  it("returns empty array when no events match", () => {
    expect(filterByHashtag(all, "lightning")).toEqual([]);
  });

  it("handles empty event list", () => {
    expect(filterByHashtag([], "bitcoin")).toEqual([]);
  });
});

describe("getReferencedPubkeys", () => {
  it("extracts pubkeys from p-tags", () => {
    const ev = makeEvent({
      tags: [
        ["p", "pk2"],
        ["p", "pk3"],
        ["e", "ev2"],
      ],
    });
    expect(getReferencedPubkeys(ev)).toEqual(["pk2", "pk3"]);
  });
});

describe("getReferencedEventIds", () => {
  it("extracts event ids from e-tags", () => {
    const ev = makeEvent({
      tags: [
        ["e", "ev2"],
        ["e", "ev3"],
        ["p", "pk2"],
      ],
    });
    expect(getReferencedEventIds(ev)).toEqual(["ev2", "ev3"]);
  });
});
