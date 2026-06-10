export interface ClusterInput {
  id: string;
  currentLabel: string;
  hashtags: string[];
  memberCount: number;
  sampleContent: string[];
}

export interface ClusterNameResult {
  id: string;
  label: string;
  tagline?: string;
}

export function buildClusterNamingPrompt(clusters: ClusterInput[]): string {
  const clusterDescriptions = clusters
    .map(
      (c, i) =>
        `Cluster ${i + 1} (id: ${c.id}):\n` +
        `  Members: ${c.memberCount}\n` +
        `  Distinctive hashtags: ${c.hashtags.slice(0, 10).join(", ") || "(none)"}\n` +
        `  Sample posts:\n${c.sampleContent
          .slice(0, 5)
          .map((s) => `    - ${s.slice(0, 200).replace(/\n/g, " ")}`)
          .join("\n")}`,
    )
    .join("\n\n");

  return `You are the editor of a live "channel guide" for communities on the Nostr social network.
For each cluster of users below, write:

1. "label" — a creative, catchy channel name (2-5 words) that piques curiosity, like a zine title or a TV channel name. It MUST be instantly verifiable: a reader who opens this community's timeline should think "yes, that's exactly what this is". Write it in the language the community posts in.
2. "tagline" — ONE plain sentence (max 60 characters) describing what these people actually post, grounded ONLY in the sample posts and hashtags above. Same language as the posts. Describe the content ("posts about ..."), never the mechanics of clustering.

Rules:
- Never use generic filler words like "Community", "Cluster", "Group", "Network" as the whole name.
- Do not invent facts. If the samples are mixed or unclear, prefer a modest descriptive name over a clever one.
- Headline and tagline must agree with each other and with the posts.

${clusterDescriptions}

Respond with ONLY a JSON array of objects with "id", "label", and "tagline" fields. No markdown, no explanation.
Example: [{"id":"cluster-0","label":"Lightning Garage","tagline":"Posts about running Bitcoin Lightning nodes and payment hacks"},{"id":"interaction-2","label":"猫すたぐらむ","tagline":"飼い猫の写真と日常を投稿する人たち"}]`;
}

export function parseClusterNamesResponse(content: string): ClusterNameResult[] {
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r: unknown): r is { id: string; label: string; tagline?: unknown } =>
          typeof r === "object" &&
          r !== null &&
          typeof (r as ClusterNameResult).id === "string" &&
          typeof (r as ClusterNameResult).label === "string",
      )
      .map((r) => ({
        id: r.id,
        label: r.label,
        tagline: typeof r.tagline === "string" && r.tagline.length > 0 ? r.tagline : undefined,
      }));
  } catch {
    return [];
  }
}
