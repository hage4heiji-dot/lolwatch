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
