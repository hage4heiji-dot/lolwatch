import { ReportCategory } from "@/generated/prisma";

export interface CategoryGuideline {
  // Riot Games公式 Community Pact (https://www.riotgames.com/en/community-pact) の該当箇所(原文引用/要約)。
  riotBasis: string;
  definition: string;
  doExamples: string[];
  dontExamples: string[];
  verdictGuidance: {
    violationConfirmed: string;
    noViolation: string;
    insufficientEvidence: string;
  };
}

// モデレーター用の判断基準。Riot Games公式のCommunity Pact(行動規範)を土台に、
// 本サイトの通報カテゴリごとに具体化したもの。運用しながら随時調整する前提のデータ。
export const MODERATION_GUIDELINES: Record<ReportCategory, CategoryGuideline> = {
  VERBAL_ABUSE: {
    riotBasis:
      "「Criticizing a play or egging on an opponent doesn't break the pact, but attacking someone's identity, threatening harm, or spamming repeated insults crosses the line.」",
    definition:
      "プレイ内容ではなく「人」そのものを対象にした攻撃的な発言。個人の能力・存在への侮辱、脅迫、執拗な暴言の連投。",
    doExamples: [
      "「お前○ね」「死ね」等の直接的な暴言・脅迫",
      "「頭おかしい」「知的障害者」など人格否定を伴う侮辱",
      "同一プレイヤーへの執拗な暴言の連投(1回のミスに対して試合中ずっと罵倒し続ける等)",
      "実生活上の脅迫を仄めかす発言(自宅・学校の特定を示唆する等)",
    ],
    dontExamples: [
      "「そのタイミングは良くなかった」等、プレイ内容への率直な指摘・批判",
      "個人攻撃を伴わない挑発(「ワンチャンイケるよね?w」等)",
      "チーム全体への一般的な不満表明(特定個人を対象としない)",
    ],
    verdictGuidance: {
      violationConfirmed:
        "リプレイのチャットログ等で、対象アカウントによる個人攻撃・脅迫・執拗な罵倒を直接確認できる場合。",
      noViolation: "プレイへの指摘や挑発に留まり、個人攻撃に該当しないと判断できる場合。",
      insufficientEvidence: "リプレイが取得できない、または該当箇所を特定・確認できない場合。",
    },
  },
  HATE_SPEECH: {
    riotBasis:
      "「language that attacks or degrades someone based on who they are—like their race, gender, nationality, or other protected characteristics」「there's no space for hate speech in our games」",
    definition:
      "人種・性別・国籍・性的指向・宗教・障害など、本人の属性そのものを理由にした侮辱・差別的発言。VERBAL_ABUSEとは別カテゴリとして特に重く扱う。",
    doExamples: [
      "人種・国籍を理由にした蔑称の使用",
      "性別・性的指向を理由にした侮辱",
      "宗教・障害・出身地等を理由にした侮辱",
    ],
    dontExamples: ["属性に触れない一般的な暴言(VERBAL_ABUSE側で検討する)"],
    verdictGuidance: {
      violationConfirmed:
        "属性を理由にした蔑称・侮辱がチャットログ等で確認できる場合。原則として一度でも明確な該当があればVIOLATION_CONFIRMEDとし、繰り返しの有無は問わない。",
      noViolation: "属性への言及ではない、または引用・注意喚起としての発言に過ぎないと判断できる場合。",
      insufficientEvidence: "該当箇所を確認できない場合。",
    },
  },
  INTENTIONAL_FEEDING: {
    riotBasis:
      "「Intentionally Feeding / Inting: When an ally dies intentionally to increase the strength of the enemy team」「Griefing: when someone intentionally ruins the game for others—trolling, teamkilling, or just causing chaos」",
    definition:
      "明確な意図を持って自キャラを敵に渡す、または試合を妨害する行為。単なる下手さ・不運とは区別する。",
    doExamples: [
      "タワーや敵陣に単身突っ込むことを、警告後も含めて繰り返す",
      "味方のキルを横取りする、味方の進路を塞ぐ等の妨害行為",
      "「わざと負ける」旨をチャットで宣言した上で、それに沿った行動をする",
      "サレンダーが否決された後、目に見えて投げやりな行動(無抵抗でのデス等)を繰り返す",
    ],
    dontExamples: [
      "単純な判断ミス・技量不足によるデス(初心者・不調・回線状況等)",
      "一度だけの無謀なプレイで、パターンとして繰り返されない場合",
      "リコールタイミングのズレなど、意図の有無が読み取れない行動",
    ],
    verdictGuidance: {
      violationConfirmed:
        "リプレイ上で「行動の繰り返しパターン」または「意図の明言」のいずれかを確認できる場合。1回限りのミスでは確定させない。",
      noViolation: "技量不足・不運によるものと判断できる場合。",
      insufficientEvidence: "目安時間周辺を確認しても、意図の有無を判断する材料が不十分な場合。",
    },
  },
  AFK_LEAVING: {
    riotBasis:
      "「Abandoning matches is prohibited, including intentional disconnects, being AFK, queue dodging, lobby hostage taking, etc.」",
    definition: "試合を放棄する行為全般。切断・無操作放置・キューダッジ・ロビー人質等。",
    doExamples: [
      "試合中、無操作のまま長時間動かない(ベースで待機し続ける等)",
      "チャットで離脱を宣言した上で操作をやめる",
      "ピック画面で意図的に応答しない(ロビー人質)",
    ],
    dontExamples: [
      "通信障害による一時的な切断で、その後復帰(reconnect)している場合",
      "アイテム購入・戦略確認等、合理的な範囲の短時間の操作停止",
    ],
    verdictGuidance: {
      violationConfirmed: "リプレイ上で、無操作放置がおおむね5分以上続いていることを確認できる場合。",
      noViolation: "復帰している場合、または通信障害によるものと推測できる場合。",
      insufficientEvidence: "放置の有無・継続時間を確認できない場合。",
    },
  },
  CHEATING: {
    riotBasis:
      "「Scripting: using 3rd party software (or hardware) to take automated actions (ie: auto-aiming or auto-dodging) or respond to in-game events on their behalf」",
    definition:
      "非公式の外部ツール・改造クライアント等を用い、人力では説明が難しい精度・反応速度・情報でプレイする行為。",
    doExamples: [
      "人力では不可能な精度でスキルショットの回避を継続する",
      "ワード等が置かれていない位置の敵情報に対して不自然に反応する(マップハック疑惑)",
      "明らかに機械的な入力パターン(オートロック/オートコンボ様の挙動)",
    ],
    dontExamples: [
      "単に上手い、反応が速いだけ(スキル差として説明できる)",
      "一度きりの好判断で、統計的に有意なパターンとまでは言えない場合",
    ],
    verdictGuidance: {
      violationConfirmed:
        "リプレイ上で、機械的としか説明のつかない反応・回避パターンを複数回確認できる場合。",
      noViolation: "スキル差として合理的に説明が付く場合。",
      insufficientEvidence:
        "断定が難しい場合は原則としてこちらに倒す(誤判定のコストが大きいカテゴリのため)。本サイトでの目視確認には限界があり、Riot公式のアンチチート(Vanguard等)による検出に委ねるべき性質のものも多い点に留意する。",
    },
  },
  SMURFING: {
    riotBasis:
      "「Smurfing occurs when a higher skilled player deliberately—typically through purchasing accounts, deranking, or account sharing—attempts to circumvent matchmaking systems」",
    definition:
      "実力のあるプレイヤーが、意図的にマッチメイキングを迂回する目的で低ランク帯のアカウントを使用する行為。単に「新規アカウントなのに上手い」だけでは足りず、迂回の意図性がポイント。",
    doExamples: [
      "アカウント購入・共有によって、実力に見合わない低ランク帯で対戦している形跡がある",
      "チャットで「サブ垢だから」「メインは○○ランク」等を明言している",
      "そのランク帯の水準を明らかに逸脱した練度のプレイが、試合を通じて一貫して続く",
    ],
    dontExamples: [
      "単に才能があり急激にランクを上げている新規プレイヤー(意図的な迂回とは言えない)",
      "復帰勢のランク再構築期間中のプレイ(Riotの仕様上想定されている挙動)",
    ],
    verdictGuidance: {
      violationConfirmed:
        "スマーフ自体はRiotの規約上グレーな部分もあるため、「アカウント売買・共有」等、明確な規約違反の証跡がある場合にVIOLATION_CONFIRMEDとする。",
      noViolation: "実力差のみを理由にした通報で、規約違反の証跡がない場合。",
      insufficientEvidence: "意図的な迂回かどうかの判断材料が不十分な場合。",
    },
  },
  ACCOUNT_TRADING: {
    riotBasis:
      "「Buying, selling, or transferring accounts violates our Terms of Service」「Solo Boosting: a high-ranked player hops on someone else's account to score them a better rank they didn't earn」",
    definition: "アカウントの売買・譲渡、および代行(ブースティング)行為。",
    doExamples: [
      "チャットや外部証跡でアカウント売買の交渉・実行が確認できる",
      "言語設定・プレイ時間帯・操作の癖が試合ごとに別人だと分かる",
      "「ブースト依頼した」等、本人以外がプレイしている旨の明言がある",
    ],
    dontExamples: [
      "家族間でのアカウント共有等、売買を伴わない私的な利用(規約上はグレーだが、本カテゴリの主目的である「売買」とは区別する)",
    ],
    verdictGuidance: {
      violationConfirmed: "売買・代行の直接的な証跡がある場合。",
      noViolation: "他人によるプレイだと確認できない場合。",
      insufficientEvidence:
        "プレイスタイルの変化のみで断定できない場合。誤判定リスクが特に高いカテゴリのため慎重に扱う。",
    },
  },
};
