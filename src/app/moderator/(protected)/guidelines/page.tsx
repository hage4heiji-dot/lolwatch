import { requireModerator } from "@/lib/moderatorAuth";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/reportCategories";
import { VERDICT_LABELS, VERDICT_BADGE_CLASS } from "@/lib/moderatorVerdicts";
import { MODERATION_GUIDELINES } from "@/lib/moderationGuidelines";
import { ReportCategory } from "@/generated/prisma";

export default async function ModerationGuidelinesPage() {
  await requireModerator();

  return (
    <div>
      <h1>モデレーター判断基準</h1>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        このページは、Riot Games公式の
        <a
          href="https://www.riotgames.com/en/community-pact"
          target="_blank"
          rel="noopener noreferrer"
        >
          Community Pact(行動規範)
        </a>
        を土台に、本サイトの通報カテゴリごとに判断基準を具体化したものです。運用しながら随時見直します。
      </p>

      <section className="section">
        <h2>判定の基本方針</h2>
        <div className="card">
          <ul style={{ paddingLeft: "1.2rem" }}>
            <li>判定は必ず対象試合のリプレイ等を実際に確認した上で行う。一般ユーザーの通報内容(カテゴリ・コメント)はあくまで参考情報であり、それ自体を根拠に判定しない。</li>
            <li>判定は「その通報(=その試合)」に対して行う。プレイヤー全体の印象や過去の評価で判断しない。</li>
            <li>疑わしいが確証が持てない場合はINSUFFICIENT_EVIDENCEを積極的に使う。特にCHEATING・ACCOUNT_TRADINGは誤判定のコストが大きいため慎重に。</li>
            <li>INTENTIONAL_FEEDING等、パターンの繰り返しが要件になっているカテゴリでは、1回のミス・不運だけでVIOLATION_CONFIRMEDにしない。</li>
          </ul>
        </div>
      </section>

      {(Object.keys(CATEGORY_LABELS) as ReportCategory[]).map((category) => {
        const g = MODERATION_GUIDELINES[category];
        return (
          <section className="section" key={category}>
            <h2>
              {CATEGORY_ICONS[category]} {CATEGORY_LABELS[category]}
            </h2>
            <div className="card">
              <p className="muted">Riot Community Pactの該当箇所: {g.riotBasis}</p>
              <p style={{ marginTop: "0.75rem" }}>
                <strong>定義:</strong> {g.definition}
              </p>

              <p style={{ marginTop: "0.75rem" }}>
                <strong>該当する例</strong>
              </p>
              <ul style={{ paddingLeft: "1.2rem" }}>
                {g.doExamples.map((example, i) => (
                  <li key={i}>{example}</li>
                ))}
              </ul>

              <p style={{ marginTop: "0.75rem" }}>
                <strong>該当しない例</strong>
              </p>
              <ul style={{ paddingLeft: "1.2rem" }}>
                {g.dontExamples.map((example, i) => (
                  <li key={i}>{example}</li>
                ))}
              </ul>

              <p style={{ marginTop: "0.75rem" }}>
                <strong>判定の目安</strong>
              </p>
              <ul style={{ paddingLeft: "1.2rem" }}>
                <li>
                  <span className={VERDICT_BADGE_CLASS.VIOLATION_CONFIRMED}>
                    {VERDICT_LABELS.VIOLATION_CONFIRMED}
                  </span>{" "}
                  {g.verdictGuidance.violationConfirmed}
                </li>
                <li style={{ marginTop: "0.35rem" }}>
                  <span className={VERDICT_BADGE_CLASS.NO_VIOLATION}>
                    {VERDICT_LABELS.NO_VIOLATION}
                  </span>{" "}
                  {g.verdictGuidance.noViolation}
                </li>
                <li style={{ marginTop: "0.35rem" }}>
                  <span className={VERDICT_BADGE_CLASS.INSUFFICIENT_EVIDENCE}>
                    {VERDICT_LABELS.INSUFFICIENT_EVIDENCE}
                  </span>{" "}
                  {g.verdictGuidance.insufficientEvidence}
                </li>
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
