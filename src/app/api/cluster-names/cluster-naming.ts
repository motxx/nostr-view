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
}

export function buildClusterNamingPrompt(clusters: ClusterInput[]): string {
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

  return `You are naming communities in a Nostr social network visualization.
For each cluster below, generate a short, descriptive name (2-5 words, in the language that best fits the community).
The name should capture the community's primary topic, culture, or identity.

${clusterDescriptions}

Respond with ONLY a JSON array of objects with "id" and "label" fields. No markdown, no explanation.
Example: [{"id":"cluster-0","label":"Bitcoin Lightning Dev"},{"id":"lang-Japanese","label":"日本語Nostrコミュニティ"}]`;
}

export function parseClusterNamesResponse(content: string): ClusterNameResult[] {
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r: unknown): r is ClusterNameResult =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as ClusterNameResult).id === "string" &&
        typeof (r as ClusterNameResult).label === "string",
    );
  } catch {
    return [];
  }
}
