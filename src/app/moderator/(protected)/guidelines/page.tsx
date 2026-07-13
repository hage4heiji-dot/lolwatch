import { requireModerator } from "@/lib/moderatorAuth";
import { GuidelinesContent } from "@/app/guidelines-content";

export default async function ModerationGuidelinesPage() {
  await requireModerator();

  return <GuidelinesContent />;
}
