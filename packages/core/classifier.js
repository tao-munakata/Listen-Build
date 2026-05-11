const TAGS = {
  BUG: {
    category: "bug",
    words: [
      "error",
      "exception",
      "stack trace",
      "failed",
      "failure",
      "bug",
      "crash",
      "再現",
      "不具合",
      "動かない",
      "失敗",
      "エラー",
      "ログ",
      "落ちる"
    ]
  },
  FEATURE: {
    category: "feature",
    words: ["feature", "improve", "enhance", "add", "追加", "改善", "欲しい", "できるように", "UX", "機能"]
  },
  REQUIREMENT: {
    category: "requirement",
    words: ["requirement", "acceptance", "user story", "must", "should", "要件", "目的", "ユーザー", "受け入れ条件"]
  },
  DESIGN: {
    category: "design",
    words: ["api", "database", "db", "docker", "schema", "sequence", "architecture", "構成", "設計", "シーケンス", "UI"]
  }
};

function classifyText(text) {
  const normalized = String(text || "").toLowerCase();
  const scores = Object.entries(TAGS).map(([tag, config]) => {
    const hits = config.words.filter((word) => normalized.includes(word.toLowerCase()));
    const structureBonus = /```|#{1,3}\s|:\s|\n-|\n\d+\./.test(text) ? 0.08 : 0;
    const score = Math.min(0.95, hits.length * 0.2 + structureBonus);
    return { tag, category: config.category, score, hits };
  });
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (!best || best.score <= 0) {
    return {
      tag: null,
      category: null,
      confidence: 0.35,
      status: "review_required",
      reason: "No strong classification keywords were found."
    };
  }

  const confidence = Math.max(0.5, Number(best.score.toFixed(2)));
  return {
    tag: best.tag,
    category: best.category,
    confidence,
    status: confidence >= 0.8 ? "pending" : "review_required",
    reason: `Matched: ${best.hits.join(", ")}`
  };
}

function tagToCategory(tag) {
  return TAGS[tag]?.category || null;
}

module.exports = { TAGS, classifyText, tagToCategory };
