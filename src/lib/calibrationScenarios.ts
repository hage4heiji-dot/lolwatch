// 「判定基準診断」で出題するシナリオ。モデレーターの判断指針(moderationGuidelines.ts)
// と同様、コード側にハードコードして運用しながら調整する前提のデータ。
// 意図的に「明確な違反」でも「明確に問題なし」でもない、判断が分かれる場面を選んでいる。
export type CalibrationScore = 1 | 2 | 3 | 4 | 5;

export const CALIBRATION_SCALE_LABELS: Record<CalibrationScore, string> = {
  1: "違反",
  2: "どちらかというと違反",
  3: "判断が難しい",
  4: "どちらかというと問題なし",
  5: "問題なし",
};

export interface CalibrationScenario {
  key: string;
  title: string;
  situation: string;
}

export const CALIBRATION_SCENARIOS: CalibrationScenario[] = [
  {
    key: "yuumi_jungle_pick",
    title: "ノーマルでのユーミジャングル",
    situation:
      "ノーマルモードで、味方の一人が通常ほぼ選ばれない「ユーミ・ジャングル」をピックした。暴言や「わざと負ける」といった発言は一切なく、本人はクロージング(視界確保・オブジェクト参加)も含めて最後まで真面目にプレイしていたが、ジャングル対面に大きく後れを取り、チームは序盤から苦戦した。",
  },
  {
    key: "surrender_denied_shutdown",
    title: "サレンダー否決後の無抵抗",
    situation:
      "サレンダー投票が僅差で否決された直後、一人が「もう無理」とチャットに書き込んだ。以降、暴言は続けなかったが、タワー下から動かず戦闘に加わらなくなり、デスもしない代わりにキルやアシストにも一切関与しなくなった。",
  },
  {
    key: "provocation_no_slur",
    title: "挑発的だが人格攻撃ではない発言の連投",
    situation:
      "レーン相手がミスするたびに「それワンチャンイケるよね?w」「今のは草」といった挑発的な発言を試合を通じて繰り返した。相手の能力や人格そのものへの直接的な侮辱(「下手くそ」「頭が悪い」等)は一度も使っていない。",
  },
  {
    key: "off_role_full_ad_support",
    title: "サポートでのフルAD系ビルド",
    situation:
      "サポートロールに割り振られたプレイヤーが「サポートは好きじゃない」とだけ発言した後、通常のサポートアイテムをほとんど積まず、アタックダメージ寄りのビルドで進行した。試合放棄はせず、レーンにも最後まで居続けた。",
  },
  {
    key: "smurf_no_confession",
    title: "自白のないスマーフ疑惑",
    situation:
      "作成から日が浅いアカウントで、そのランク帯の水準を明らかに超える正確なプレイ(オブジェクトタイミングの把握、安定したレーニング)を試合を通じて一貫して見せていた。チャットでの自白や挑発は一切ない。",
  },
  {
    key: "tilt_after_early_deaths",
    title: "序盤の連続デス後の無謀な突撃",
    situation:
      "序盤にソロキルを3回連続で取られた後、「もう建て直せない」とチャットで漏らし、その後何度か単騎で敵陣に突っ込んでデスを重ねた。ただし毎回ではなく、要所ではリコールして装備を整える場面もあった。",
  },
  {
    key: "brief_afk_then_return",
    title: "数分間の放置からの復帰",
    situation:
      "試合中盤、味方の一人が約3分間まったく操作をせず、キャラクターがその場に立ち尽くしていた。理由の説明は特になかったが、その後は何事もなかったように操作を再開し、最後までプレイを続けた。",
  },
  {
    key: "family_account_share",
    title: "家族による代打ち宣言",
    situation:
      "試合の途中でチャットに「ちょっと弟に代わってもらいます」という発言があり、以降は明らかにプレイの質が落ちた(操作ミスが増えた)。金銭のやり取りや依頼募集を示すような発言は見当たらない。",
  },
  {
    key: "duo_grudge_criticism",
    title: "前の試合の相手への辛辣な指摘",
    situation:
      "前の試合で負けた相手と再度マッチングし、その相手のプレイミスのたびに「さっきの試合でも同じミスしてたな」「また同じことしてる」と繰り返し指摘した。侮辱的な単語は使っていないが、明らかに他のミスより執拗に反応していた。",
  },
];

export const CALIBRATION_SCENARIO_KEYS = CALIBRATION_SCENARIOS.map((s) => s.key);

export function isCalibrationScenarioKey(key: string): boolean {
  return CALIBRATION_SCENARIO_KEYS.includes(key);
}

export function isCalibrationScore(value: number): value is CalibrationScore {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}
