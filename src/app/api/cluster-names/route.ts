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
    return NextResponse.json({ results: [], error: "No clusters provided" });
  }

  const prompt = buildClusterNamingPrompt(clusters);

  try {
    const apiKey = process.env.CLAUDE_PROXY_API_KEY ?? "not-needed";
    const url = `${CLAUDE_PROXY_URL}/v1/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const error = `Proxy ${response.status}: ${body.slice(0, 500)}`;
      console.error("Claude proxy error:", error);
      return NextResponse.json({ results: [], error }, { status: 502 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    if (!content) {
      const error = `Empty content from proxy. Raw response: ${JSON.stringify(data).slice(0, 500)}`;
      console.error(error);
      return NextResponse.json({ results: [], error }, { status: 502 });
    }

    const results = parseClusterNamesResponse(content);

    if (results.length === 0) {
      const error = `Failed to parse LLM response: ${content.slice(0, 500)}`;
      console.error(error);
      return NextResponse.json({ results: [], error }, { status: 502 });
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Cluster naming error:", message);
    return NextResponse.json(
      { results: [], error: `Fetch failed: ${message}` },
      { status: 502 },
    );
  }
}
