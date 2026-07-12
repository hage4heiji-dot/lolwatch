import { ModeratorVerdict } from "@/generated/prisma";

export const VERDICT_LABELS: Record<ModeratorVerdict, string> = {
  VIOLATION_CONFIRMED: "違反を確認",
  NO_VIOLATION: "違反なしと判断",
  INSUFFICIENT_EVIDENCE: "証拠不十分",
};

export const VERDICT_BADGE_CLASS: Record<ModeratorVerdict, string> = {
  VIOLATION_CONFIRMED: "badge badge-verified-guilty",
  NO_VIOLATION: "badge badge-verified",
  INSUFFICIENT_EVIDENCE: "badge",
};

export const VERDICT_ICONS: Record<ModeratorVerdict, string> = {
  VIOLATION_CONFIRMED: "⚠️",
  NO_VIOLATION: "✅",
  INSUFFICIENT_EVIDENCE: "❓",
};
