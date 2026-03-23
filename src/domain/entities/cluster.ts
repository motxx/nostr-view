export interface Cluster {
  id: string;
  label: string;
  hashtags: string[];
  memberPubkeys: Set<string>;
  color: string;
  centerX?: number;
  centerY?: number;
  centerZ?: number;
}

const CLUSTER_COLORS = [
  "#4fc3f7", // blue - Bitcoin/Lightning
  "#ab47bc", // purple - Privacy
  "#66bb6a", // green - Dev
  "#ffa726", // orange - Art
  "#ef5350", // red - Politics
  "#26c6da", // cyan - Science
  "#ffee58", // yellow - Memes
  "#ec407a", // pink - Music
  "#8d6e63", // brown - Philosophy
  "#78909c", // grey - General
];

export function getClusterColor(index: number): string {
  return CLUSTER_COLORS[index % CLUSTER_COLORS.length];
}
