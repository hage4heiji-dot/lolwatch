import { ArticleKind } from "@/generated/prisma";

export const ARTICLE_KIND_LABELS: Record<ArticleKind, string> = {
  INCIDENT: "炎上案件",
  JUDGMENT: "行為判定",
};

export const ARTICLE_KIND_ICONS: Record<ArticleKind, string> = {
  INCIDENT: "🔥",
  JUDGMENT: "🤔",
};

export const ARTICLE_KIND_ORDER: ArticleKind[] = ["INCIDENT", "JUDGMENT"];
