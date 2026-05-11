const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "auto";
const PREFERRED_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-pro"
];

function requireWebhookToken(req, url) {
  const expected = process.env.AI_DEV_OS_WEBHOOK_TOKEN;
  if (!expected) return;
  const headerToken = req.headers["x-ai-dev-os-token"];
  const queryToken = url.searchParams.get("token");
  if (headerToken !== expected && queryToken !== expected) {
    throw Object.assign(new Error("Invalid webhook token"), { statusCode: 401 });
  }
}

function extractGeminiText(data) {
  const parts = data?.candidates?.flatMap((candidate) => candidate?.content?.parts || []) || [];
  return parts.map((part) => part.text || "").filter(Boolean).join("\n\n").trim();
}

function parseJsonObject(text) {
  const trimmed = String(text || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini did not return JSON");
    return JSON.parse(match[0]);
  }
}

async function callGemini(prompt, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("GEMINI_API_KEY is not set"), { statusCode: 400 });
  }

  const model = await resolveGeminiModel(apiKey, options.model || DEFAULT_GEMINI_MODEL);
  const endpoint = geminiEndpoint(apiKey, model);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: Number(options.temperature ?? 0.4)
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Gemini API request failed with ${response.status}`;
    throw Object.assign(new Error(message), { statusCode: response.status });
  }

  const text = extractGeminiText(data);
  if (!text) {
    throw Object.assign(new Error("Gemini returned no text"), { statusCode: 502 });
  }

  return {
    model,
    text,
    raw: data
  };
}

async function classifyWithGemini(rawContent) {
  const prompt = [
    "You are the Inbox classifier for an AI development operating system.",
    "Classify the user's text into exactly one of these tags: BUG, FEATURE, REQUIREMENT, DESIGN, IDEA.",
    "Return only strict JSON with these keys:",
    "tag, category, confidence, title, reason.",
    "category must be one of: bug, feature, requirement, design, idea.",
    "confidence must be a number from 0 to 1.",
    "title must be Japanese, concise, and no longer than 40 characters.",
    "",
    "Text:",
    rawContent
  ].join("\n");
  const result = await callGemini(prompt, { temperature: 0.1 });
  const parsed = parseJsonObject(result.text);
  const tag = normalizeTag(parsed.tag);
  const category = normalizeCategory(parsed.category, tag);
  return {
    tag,
    category,
    confidence: clampConfidence(parsed.confidence),
    title: String(parsed.title || "").slice(0, 80) || "AI分類メモ",
    reason: String(parsed.reason || `Classified by Gemini using ${result.model}`),
    model: result.model
  };
}

function normalizeTag(tag) {
  const value = String(tag || "").trim().toUpperCase();
  return ["BUG", "FEATURE", "REQUIREMENT", "DESIGN", "IDEA"].includes(value) ? value : "IDEA";
}

function normalizeCategory(category, tag) {
  const value = String(category || "").trim().toLowerCase();
  if (["bug", "feature", "requirement", "design", "idea"].includes(value)) return value;
  const map = {
    BUG: "bug",
    FEATURE: "feature",
    REQUIREMENT: "requirement",
    DESIGN: "design",
    IDEA: "idea"
  };
  return map[tag] || "idea";
}

function clampConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.75;
  return Math.max(0, Math.min(1, Number(number.toFixed(2))));
}

function geminiEndpoint(apiKey, model) {
  const modelName = String(model).startsWith("models/") ? String(model).slice("models/".length) : model;
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

async function listGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("GEMINI_API_KEY is not set"), { statusCode: 400 });
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Gemini model list failed with ${response.status}`;
    throw Object.assign(new Error(message), { statusCode: response.status });
  }

  return (data.models || []).map((model) => ({
    name: model.name,
    displayName: model.displayName,
    supportedGenerationMethods: model.supportedGenerationMethods || []
  }));
}

async function resolveGeminiModel(apiKey, requestedModel) {
  const requested = String(requestedModel || "").replace(/^models\//, "");
  if (requested && requested !== "auto") return requested;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Gemini model list failed with ${response.status}`;
    throw Object.assign(new Error(message), { statusCode: response.status });
  }

  const models = (data.models || []).filter((model) =>
    (model.supportedGenerationMethods || []).includes("generateContent")
  );
  const names = models.map((model) => model.name.replace(/^models\//, ""));
  const preferred = PREFERRED_GEMINI_MODELS.find((name) => names.includes(name));
  if (preferred) return preferred;
  if (names[0]) return names[0];
  throw Object.assign(new Error("No Gemini model supporting generateContent was found"), { statusCode: 502 });
}

module.exports = { callGemini, classifyWithGemini, listGeminiModels, requireWebhookToken };
