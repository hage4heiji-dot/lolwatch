import { ArticleSeverity } from "@/generated/prisma";

export const SEVERITY_LABELS: Record<ArticleSeverity, string> = {
  LOW: "小炎上",
  MEDIUM: "中炎上",
  HIGH: "大炎上",
  CRITICAL: "特大炎上",
};

export const SEVERITY_ICONS: Record<ArticleSeverity, string> = {
  LOW: "🔥",
  MEDIUM: "🔥🔥",
  HIGH: "🔥🔥🔥",
  CRITICAL: "🔥🔥🔥🔥",
};

export const SEVERITY_ORDER: ArticleSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

// 記事執筆時にモデレーターが判断に迷わないよう、拡散範囲・報道の有無・当事者への
// 実害(処罰/活動自粛等)を目安に4段階を定義する。判定基準診断のシナリオと同様、
// 厳密な数値基準ではなく運用しながら調整する前提の目安。
export const SEVERITY_DESCRIPTIONS: Record<ArticleSeverity, string> = {
  LOW: "一部のコミュニティ内で話題になった程度。拡散は限定的で、ニュースサイト等では取り上げられていない。実害・処罰は基本的になし。",
  MEDIUM: "SNS上で広く拡散し、ミーム化するなど一定の知名度を得た。ゲーム系ニュースサイトで報じられる程度。当事者への直接的な処罰・活動自粛には至っていない。",
  HIGH: "大手メディア・複数のニュースサイトで報じられ、当事者(プレイヤー・運営・公式等)に謝罪・処罰・活動自粛等、何らかの具体的な対応が発生した。",
  CRITICAL: "業界内外に広く波及し、公式の重大な方針変更・長期の活動停止・法的措置など、深刻かつ長期に及ぶ実害を伴う。",
};
