import { describe, it, expect } from "vitest";
import { parseProfileContent } from "./nostr-profile";

describe("parseProfileContent", () => {
  it("parses valid profile JSON", () => {
    const content = JSON.stringify({
      name: "alice",
      display_name: "Alice Wonder",
      picture: "https://example.com/alice.png",
      about: "Hello world",
      nip05: "alice@example.com",
      lud16: "alice@walletofsatoshi.com",
    });

    const profile = parseProfileContent("pk1", content);
    expect(profile.pubkey).toBe("pk1");
    expect(profile.name).toBe("alice");
    expect(profile.displayName).toBe("Alice Wonder");
    expect(profile.picture).toBe("https://example.com/alice.png");
    expect(profile.about).toBe("Hello world");
    expect(profile.nip05).toBe("alice@example.com");
    expect(profile.lud16).toBe("alice@walletofsatoshi.com");
    expect(profile.fetchedAt).toBeGreaterThan(0);
  });

  it("handles partial profile data", () => {
    const content = JSON.stringify({ name: "bob" });
    const profile = parseProfileContent("pk2", content);
    expect(profile.name).toBe("bob");
    expect(profile.displayName).toBeUndefined();
    expect(profile.picture).toBeUndefined();
  });

  it("returns fallback on invalid JSON", () => {
    const profile = parseProfileContent("pk3", "not json");
    expect(profile.pubkey).toBe("pk3");
    expect(profile.name).toBeUndefined();
    expect(profile.fetchedAt).toBeGreaterThan(0);
  });

  it("returns fallback on empty string", () => {
    const profile = parseProfileContent("pk4", "");
    expect(profile.pubkey).toBe("pk4");
  });
});
