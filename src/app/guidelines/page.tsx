import type { Metadata } from "next";
import { GuidelinesContent } from "@/app/guidelines-content";

export const metadata: Metadata = {
  title: "ガイドライン",
  description: "lolwatchにおける通報・モデレーター評価の判断基準を説明します。",
};

export default function GuidelinesPage() {
  return <GuidelinesContent />;
}
