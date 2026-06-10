import { describe, it, expect } from "vitest";
import {
  buildClusterNamingPrompt,
  parseClusterNamesResponse,
  type ClusterInput,
} from "./cluster-naming";

describe("buildClusterNamingPrompt", () => {
  const clusters: ClusterInput[] = [
    {
      id: "cluster-0",
      currentLabel: "bitcoin, lightning",
      hashtags: ["bitcoin", "lightning", "nostr"],
      memberCount: 42,
      sampleContent: ["Great day for bitcoin!", "Lightning network is amazing"],
    },
    {
      id: "lang-Japanese",
      currentLabel: "Japanese",
      hashtags: [],
      memberCount: 15,
      sampleContent: ["こんにちは、nostrの世界へ"],
    },
  ];

  it("includes all cluster IDs in the prompt", () => {
    const prompt = buildClusterNamingPrompt(clusters);
    expect(prompt).toContain("cluster-0");
    expect(prompt).toContain("lang-Japanese");
  });

  it("includes hashtags", () => {
    const prompt = buildClusterNamingPrompt(clusters);
    expect(prompt).toContain("bitcoin, lightning, nostr");
  });

  it("includes member count", () => {
    const prompt = buildClusterNamingPrompt(clusters);
    expect(prompt).toContain("Members: 42");
    expect(prompt).toContain("Members: 15");
  });

  it("includes sample content", () => {
    const prompt = buildClusterNamingPrompt(clusters);
    expect(prompt).toContain("Great day for bitcoin!");
    expect(prompt).toContain("こんにちは、nostrの世界へ");
  });

  it("shows (none) when hashtags are empty", () => {
    const prompt = buildClusterNamingPrompt(clusters);
    expect(prompt).toContain("(none)");
  });

  it("truncates sample content to 200 chars", () => {
    const longContent = "x".repeat(250);
    const input: ClusterInput[] = [{
      id: "c1",
      currentLabel: "test",
      hashtags: [],
      memberCount: 1,
      sampleContent: [longContent],
    }];
    const prompt = buildClusterNamingPrompt(input);
    expect(prompt).not.toContain("x".repeat(201));
    expect(prompt).toContain("x".repeat(200));
  });

  it("limits to 5 sample posts", () => {
    const input: ClusterInput[] = [{
      id: "c1",
      currentLabel: "test",
      hashtags: [],
      memberCount: 1,
      sampleContent: ["post1", "post2", "post3", "post4", "post5", "post6"],
    }];
    const prompt = buildClusterNamingPrompt(input);
    expect(prompt).toContain("post1");
    expect(prompt).toContain("post5");
    expect(prompt).not.toContain("post6");
  });

  it("asks for label and tagline", () => {
    const prompt = buildClusterNamingPrompt(clusters);
    expect(prompt).toContain('"label"');
    expect(prompt).toContain('"tagline"');
  });

  it("limits to 10 hashtags", () => {
    const tags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
    const input: ClusterInput[] = [{
      id: "c1",
      currentLabel: "test",
      hashtags: tags,
      memberCount: 1,
      sampleContent: [],
    }];
    const prompt = buildClusterNamingPrompt(input);
    expect(prompt).toContain("tag9");
    expect(prompt).not.toContain("tag10");
  });
});

describe("parseClusterNamesResponse", () => {
  it("parses valid JSON array response", () => {
    const content = '[{"id":"c1","label":"BTC Maxis"},{"id":"c2","label":"Nostr Devs"}]';
    const results = parseClusterNamesResponse(content);
    expect(results).toEqual([
      { id: "c1", label: "BTC Maxis" },
      { id: "c2", label: "Nostr Devs" },
    ]);
  });

  it("extracts JSON from surrounding text", () => {
    const content = 'Here are the names:\n[{"id":"c1","label":"Test"}]\nDone!';
    const results = parseClusterNamesResponse(content);
    expect(results).toHaveLength(1);
    expect(results[0].label).toBe("Test");
  });

  it("returns empty array for non-JSON content", () => {
    expect(parseClusterNamesResponse("I cannot do that")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseClusterNamesResponse("")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseClusterNamesResponse("[{broken json}]")).toEqual([]);
  });

  it("filters out entries missing id or label", () => {
    const content = '[{"id":"c1","label":"Good"},{"id":"c2"},{"label":"NoId"},{"other":"field"}]';
    const results = parseClusterNamesResponse(content);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ id: "c1", label: "Good" });
  });

  it("handles response with non-string id/label", () => {
    const content = '[{"id":123,"label":"Bad"},{"id":"c1","label":"Good"}]';
    const results = parseClusterNamesResponse(content);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("c1");
  });

  it("parses taglines when present", () => {
    const content =
      '[{"id":"c1","label":"Lightning Garage","tagline":"Posts about running LN nodes"}]';
    const results = parseClusterNamesResponse(content);
    expect(results[0].tagline).toBe("Posts about running LN nodes");
  });

  it("drops non-string or empty taglines", () => {
    const content =
      '[{"id":"c1","label":"A","tagline":123},{"id":"c2","label":"B","tagline":""}]';
    const results = parseClusterNamesResponse(content);
    expect(results[0].tagline).toBeUndefined();
    expect(results[1].tagline).toBeUndefined();
  });

  it("handles multiline JSON response", () => {
    const content = `[
  {"id": "c1", "label": "日本語コミュニティ"},
  {"id": "c2", "label": "Bitcoin Builders"}
]`;
    const results = parseClusterNamesResponse(content);
    expect(results).toHaveLength(2);
    expect(results[0].label).toBe("日本語コミュニティ");
  });

  it("returns empty array when response is a JSON object (not array)", () => {
    expect(parseClusterNamesResponse('{"id":"c1","label":"Test"}')).toEqual([]);
  });
});
