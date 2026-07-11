import { ReportCategory } from "@/generated/prisma";

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  VERBAL_ABUSE: "暴言",
  HATE_SPEECH: "差別的発言",
  INTENTIONAL_FEEDING: "意図的な敗北行為",
  AFK_LEAVING: "放置・途中退出",
  CHEATING: "チート使用疑惑",
  SMURFING: "スマーフ疑惑",
  ACCOUNT_TRADING: "アカウント売買・譲渡疑惑",
};
