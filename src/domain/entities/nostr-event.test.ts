import { describe, it, expect } from "vitest";
import {
  getHashtags,
  getReferencedPubkeys,
  getReferencedEventIds,
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
