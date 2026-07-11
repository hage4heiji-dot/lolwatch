const QUEUE_LABELS: Record<number, string> = {
  400: "ノーマル(ドラフト)",
  420: "ランクソロ/デュオ",
  430: "ノーマル(ブラインド)",
  440: "ランクフレックス",
  450: "ARAM",
  700: "クラッシュ",
  900: "アルティメット・スペルブック",
  1700: "アリーナ",
  1900: "URF",
};

export function queueLabel(queueId: number): string {
  return QUEUE_LABELS[queueId] ?? `その他(queue ${queueId})`;
}
