import { NextResponse } from "next/server";
import {
  buildClusterNamingPrompt,
  parseClusterNamesResponse,
  type ClusterInput,
} from "./cluster-naming";

const CLAUDE_PROXY_URL =
  process.env.CLAUDE_PROXY_URL ?? "https://claude-max-api-proxy.fly.dev";

export async function POST(req: Request) {
  const { clusters } = (await req.json()) as { clusters: ClusterInput[] };

  if (!clusters || clusters.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const prompt = buildClusterNamingPrompt(clusters);

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
    const results = parseClusterNamesResponse(content);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Cluster naming error:", error);
    return NextResponse.json({ results: [] });
  }
}
