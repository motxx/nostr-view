import { NextResponse } from "next/server";

const CLAUDE_PROXY_URL =
  process.env.CLAUDE_PROXY_URL ?? "https://claude-max-api-proxy.fly.dev";

interface ClusterInput {
  id: string;
  currentLabel: string;
  hashtags: string[];
  memberCount: number;
  sampleContent: string[];
}

interface ClusterNameResult {
  id: string;
  label: string;
}

export async function POST(req: Request) {
  const { clusters } = (await req.json()) as { clusters: ClusterInput[] };

  if (!clusters || clusters.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const clusterDescriptions = clusters
    .map(
      (c, i) =>
        `Cluster ${i + 1} (id: ${c.id}):\n` +
        `  Current label: ${c.currentLabel}\n` +
        `  Members: ${c.memberCount}\n` +
        `  Hashtags: ${c.hashtags.slice(0, 10).join(", ") || "(none)"}\n` +
        `  Sample posts:\n${c.sampleContent
          .slice(0, 3)
          .map((s) => `    - ${s.slice(0, 150)}`)
          .join("\n")}`,
    )
    .join("\n\n");

  const prompt = `You are naming communities in a Nostr social network visualization.
For each cluster below, generate a short, descriptive name (2-5 words, in the language that best fits the community).
The name should capture the community's primary topic, culture, or identity.

${clusterDescriptions}

Respond with ONLY a JSON array of objects with "id" and "label" fields. No markdown, no explanation.
Example: [{"id":"cluster-0","label":"Bitcoin Lightning Dev"},{"id":"lang-Japanese","label":"日本語Nostrコミュニティ"}]`;

  try {
    const response = await fetch(`${CLAUDE_PROXY_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      console.error("Claude proxy error:", response.status, await response.text());
      return NextResponse.json({ results: [] });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    // Parse JSON from response (may have surrounding whitespace)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("Failed to parse cluster names from LLM response:", content);
      return NextResponse.json({ results: [] });
    }

    const results: ClusterNameResult[] = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Cluster naming error:", error);
    return NextResponse.json({ results: [] });
  }
}
